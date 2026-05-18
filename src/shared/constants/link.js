import { GITHUB_BASE, REPOSITORY } from './settings';

const links = {
    wiki: `${GITHUB_BASE}/wiki`,
    troubleshootingAuthUserConnectionIssues:
        `${GITHUB_BASE}/wiki/Troubleshooting#401-authuser--connection-issues`,
    github: GITHUB_BASE,
    githubReleases: `${GITHUB_BASE}/releases`,
    githubContributors: `${GITHUB_BASE}/graphs/contributors`,
    githubContributorsImage: `https://contrib.rocks/image?repo=${REPOSITORY}`,
    discord: 'https://vrcx.app/discord'
};

export { links };
