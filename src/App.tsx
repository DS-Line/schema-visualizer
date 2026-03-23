import { SchemaEditor } from "./components/SchemaEditor"

const sampleDBML = `Table data_quality_tracking {
  limitflags       jsonb
  stellarmasserr2  real
  stellarraderr1   real
  stellarraderr2   real
  updatestamp      date
  qualityref       bigint  [pk]
  targetlink       bigint
  perioderr1       real
  perioderr2       real
  semimajerr1      real
  semimajerr2      real
  eccerr1          real
  eccerr2          real
  inclerr1         real
  inclerr2         real
  masserr1         real
  masserr2         real
  raderr1          real
  raderr2          real
  denserr1         real
  denserr2         real
  disterr1         real
  disterr2         real
  optmagerr        real
  temperr1         real
  temperr2         real
  stellarmasserr1  real
  masssource       text
}

Table instruments_surveys {
  instrumentref  bigint   [pk]
  facilityname   varchar  [unique]
}

Table orbital_characteristics {
  orbitalref    bigint  [pk]
  bodylink      bigint
  period        real
  semimajor     real
  eccentricity  real
  inclination   real
}

Table physical_properties {
  physref     bigint  [pk]
  objectlink  bigint
  massjup     real
  radjup      real
  densvalue   real
}

Table planet_instrument_observations {
  obsref        bigint  [pk]
  subjectlink   bigint  [unique]
  facilitylink  bigint  [unique]
}

Table planets {
  planetref   bigint  [pk]
  hostlink    bigint  [unique]
  notecount   bigint
  completter  text    [unique]
  discmethod  text
}

Table stars {
  stellarref    bigint  [pk]
  stellardist   real
  compcount     bigint
  coordsys      jsonb
  stellarprops  jsonb
  hostplname    text    [unique]
}

Ref: data_quality_tracking.targetlink > planets.planetref
Ref: orbital_characteristics.bodylink > planets.planetref
Ref: physical_properties.objectlink > planets.planetref
Ref: planet_instrument_observations.facilitylink > instruments_surveys.instrumentref
Ref: planet_instrument_observations.subjectlink > planets.planetref
Ref: planets.hostlink > stars.stellarref
`

export default function App() {
  return (
    <div className="h-screen w-screen">
      <SchemaEditor defaultValue={{ schema: sampleDBML, cachedColumns: [] }} />
    </div>
  )
}
