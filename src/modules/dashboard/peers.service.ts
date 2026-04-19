import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { Project } from '../activity/schemas/project.schema';
import { Activity } from '../activity/schemas/activity.schema';
import { PeerCardDto } from './dto/peers-search.dto';

@Injectable()
export class PeersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
  ) {}

  private coerceSeconds(value: unknown): number {
    if (value == null || value === '') {
      return 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
      const n = Number(String(value));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Discover other Zenno users; optional query matches name, bio, skills, project names, app names (substring, case-insensitive).
   * Multi-word query: every token must match somewhere in the combined searchable text.
   */
  async searchPeers(email: string, rawQuery: string): Promise<PeerCardDto[]> {
    const me = await this.userModel.findOne({ email }).lean();
    if (!me) {
      throw new BadRequestException('User not found');
    }

    const needle = (rawQuery || '').trim().toLowerCase();
    const tokens = needle.length > 0 ? needle.split(/\s+/).filter((t) => t.length > 0) : [];

    const maxScan = 200;
    const others = await this.userModel
      .find({ _id: { $ne: me._id as Types.ObjectId }, isVerified: true })
      .select('name profilePhoto description isVerified profile_preferences')
      .limit(maxScan)
      .sort({ name: 1 })
      .lean();

    if (others.length === 0) {
      return [];
    }

    const userIds = others.map((u) => u._id);

    const [allProjects, allActivities] = await Promise.all([
      this.projectModel.find({ user_id: { $in: userIds } }).lean(),
      this.activityModel.find({ user_id: { $in: userIds } }).lean(),
    ]);

    const projectsByUser = new Map<string, Project[]>();
    for (const p of allProjects) {
      const key = String(p.user_id);
      if (!projectsByUser.has(key)) {
        projectsByUser.set(key, []);
      }
      projectsByUser.get(key)!.push(p as Project);
    }

    const activitiesByUser = new Map<string, Activity[]>();
    for (const a of allActivities) {
      const key = String(a.user_id);
      if (!activitiesByUser.has(key)) {
        activitiesByUser.set(key, []);
      }
      activitiesByUser.get(key)!.push(a as Activity);
    }

    const appTotalsByUser = new Map<string, Map<string, number>>();
    for (const a of allActivities) {
      const uid = String(a.user_id);
      if (!a.apps) {
        continue;
      }
      const apps =
        a.apps instanceof Map ? a.apps : new Map(Object.entries(a.apps as Record<string, number>));
      let map = appTotalsByUser.get(uid);
      if (!map) {
        map = new Map();
        appTotalsByUser.set(uid, map);
      }
      for (const [name, sec] of apps) {
        const key = (name || '').trim() || 'Unknown';
        map.set(key, (map.get(key) || 0) + this.coerceSeconds(sec));
      }
    }

    const results: PeerCardDto[] = [];

    for (const u of others) {
      const uid = String(u._id);
      const projects = projectsByUser.get(uid) || [];

      // Honour the developer's own privacy choices: anything they marked
      // hidden on their profile must NOT leak through the peer card. We
      // intentionally use Sets for O(1) lookups inside the inner loops.
      const prefs = u.profile_preferences;
      const hiddenSkillNames = new Set<string>(prefs?.hidden_skill_names ?? []);
      const hiddenAppNames = new Set<string>(prefs?.hidden_app_names ?? []);
      const hiddenProjectNames = new Set<string>(prefs?.hidden_project_names ?? []);

      const skillSec = new Map<string, number>();
      const projectLabels: string[] = [];
      const projectTextForSearch: string[] = [];

      for (const p of projects) {
        // Hidden projects must contribute neither a card label NOR their
        // skills — those skills would otherwise show up in `top_skills`
        // even though the developer chose to hide the underlying project.
        if (hiddenProjectNames.has(p.project_name)) {
          continue;
        }
        const display = p.display_name?.trim();
        projectLabels.push(display && display.length > 0 ? display : p.project_name);
        if (p.description?.trim()) {
          projectTextForSearch.push(p.description.trim());
        }
        for (const s of p.project_skills || []) {
          const n = (s.skill_name || '').trim();
          if (!n || hiddenSkillNames.has(n)) {
            continue;
          }
          skillSec.set(n, (skillSec.get(n) || 0) + this.coerceSeconds(s.duration_sec));
        }
      }

      // Cap each section at 4 — keeps the peer card compact (matches
      // the website + mobile design) and avoids dumping every single
      // tag a developer has ever recorded.
      const peerCardLimit = 4;

      const top_skills = Array.from(skillSec.entries())
        .filter(([, sec]) => sec > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, peerCardLimit)
        .map(([name]) => name);

      const appMap = appTotalsByUser.get(uid);
      const top_apps = appMap
        ? Array.from(appMap.entries())
            .filter(([name, sec]) => sec > 0 && !hiddenAppNames.has(name))
            .sort((a, b) => b[1] - a[1])
            .slice(0, peerCardLimit)
            .map(([name]) => name)
        : [];

      // De-dup *after* filtering so a project hidden under one of its
      // labels doesn't accidentally come back via the other one.
      const uniqueProjects = Array.from(new Set(projectLabels)).slice(0, peerCardLimit);
      const bio = (u.description || '').trim();

      const searchable = [
        u.name || '',
        bio,
        ...top_skills,
        ...uniqueProjects,
        ...projectTextForSearch,
        ...top_apps,
      ]
        .join(' ')
        .toLowerCase();

      if (tokens.length > 0) {
        const ok = tokens.every((t) => searchable.includes(t));
        if (!ok) {
          continue;
        }
      }

      results.push({
        user_id: uid,
        name: u.name || 'Developer',
        profile_photo_url: u.profilePhoto ?? null,
        bio: bio.slice(0, 220),
        top_skills,
        top_projects: uniqueProjects,
        top_apps,
      });
    }

    return results.slice(0, 60);
  }
}
