export const getCurrentSeasonDefinition = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 5 ? year : year - 1;

  return {
    name: `${startYear}/${startYear + 1}`,
    startsOn: `${startYear}-06-01`,
    endsOn: `${startYear + 1}-05-31`
  };
};

export const getLatestSeasonBefore = (seasons, seasonName) =>
  (Array.isArray(seasons) ? seasons : [])
    .filter((season) => season?.season_name !== seasonName)
    .sort((a, b) => String(b?.starts_on || "").localeCompare(String(a?.starts_on || "")))[0] || null;
