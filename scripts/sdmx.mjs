// Minimal SDMX-ML (StructureSpecificData) parser for the INSEE BDM API.
// The BDM payloads are flat: <Series attr=".."><Obs TIME_PERIOD=".." OBS_VALUE=".."/></Series>,
// so attribute-level regex parsing is enough and keeps the script dependency-free.

const ATTR_RE = /([A-Za-z_][\w.-]*)="([^"]*)"/g

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

export function parseAttrs(tag) {
  const attrs = {}
  for (const [, k, v] of tag.matchAll(ATTR_RE)) attrs[k] = decode(v)
  return attrs
}

export function parseSeries(xml) {
  const out = []
  const seriesRe = /<(?:\w+:)?Series\b([^>]*?)(\/>|>([\s\S]*?)<\/(?:\w+:)?Series>)/g
  for (const m of xml.matchAll(seriesRe)) {
    const attrs = parseAttrs(m[1])
    const observations = []
    for (const o of (m[3] ?? '').matchAll(/<(?:\w+:)?Obs\b([^>]*?)\/?>/g)) {
      const a = parseAttrs(o[1])
      const value = Number(a.OBS_VALUE)
      if (a.TIME_PERIOD && a.OBS_VALUE !== undefined && a.OBS_VALUE !== '' && Number.isFinite(value)) {
        observations.push({ date: a.TIME_PERIOD, value, status: a.OBS_STATUS })
      }
    }
    observations.sort((x, y) => x.date.localeCompare(y.date))
    out.push({ attrs, observations })
  }
  return out
}
