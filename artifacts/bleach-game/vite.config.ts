const getBasePath = (): string => {
  if (process.env.IS_VERCEL === "true") {
    return "/";
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    return "/soul-reaper-metroidvania/"; 
  }
  return process.env.BASE_PATH || "/";
};