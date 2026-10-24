export interface GitHubProfileStats {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
  totalStars: number;
  topRepositories: Array<{
    name: string;
    description: string;
    language: string;
    stars: number;
    forks: number;
    url: string;
  }>;
}

const cacheMap = new Map<string, { timestamp: number; stats: GitHubProfileStats }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

export class GitHubService {
  public async getProfileStats(username: string = 'anishjethva18'): Promise<GitHubProfileStats | null> {
    const cleanUser = username.trim().toLowerCase();
    const cached = cacheMap.get(cleanUser);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.stats;
    }

    try {
      // 1. Fetch user data from GitHub API
      const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUser)}`, {
        headers: {
          'User-Agent': 'Win11PortfolioBackend/2.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userRes.ok) {
        return null;
      }

      const userData: any = await userRes.json();

      // 2. Fetch public repositories
      const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUser)}/repos?sort=updated&per_page=10`, {
        headers: {
          'User-Agent': 'Win11PortfolioBackend/2.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      let reposData: any = [];
      if (reposRes.ok) {
        reposData = await reposRes.json();
      }

      let totalStars = 0;
      const topRepos = (Array.isArray(reposData) ? reposData : []).map((r: any) => {
        totalStars += r.stargazers_count || 0;
        return {
          name: r.name,
          description: r.description || '',
          language: r.language || 'Code',
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          url: r.html_url || `https://github.com/${cleanUser}/${r.name}`,
        };
      });

      const stats: GitHubProfileStats = {
        username: userData.login || cleanUser,
        name: userData.name || userData.login || cleanUser,
        bio: userData.bio || '',
        avatarUrl: userData.avatar_url || '',
        publicRepos: userData.public_repos || 0,
        followers: userData.followers || 0,
        following: userData.following || 0,
        totalStars,
        topRepositories: topRepos,
      };

      cacheMap.set(cleanUser, { timestamp: Date.now(), stats });
      return stats;
    } catch (e) {
      console.warn('[GitHubService] Live GitHub fetch error:', e);
      return null;
    }
  }
}

export const githubService = new GitHubService();
