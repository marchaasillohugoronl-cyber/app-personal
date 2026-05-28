/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Excluir del bundle de webpack — se resuelven en Node.js nativo
    serverComponentsExternalPackages: ["yt-search", "cheerio"],
  },
};

export default nextConfig;
