// Display names for event sources.
export const SOURCE_LABELS = {
  district: 'District',
  bookmyshow: 'BookMyShow',
  allevents: 'AllEvents',
  townscript: 'Townscript',
  virasat: 'Virasat',
  thrillzone: 'Thrill Zone',
  literaturefestival: 'Dehradun Literature Festival',
  meetup: 'Meetup',
  reddit: 'r/Dehradun',
  manual: 'doon.today'
};

export const sourceLabel = (provider) => SOURCE_LABELS[provider] ?? provider;
