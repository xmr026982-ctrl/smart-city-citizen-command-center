
const CITIZEN_ZONES = [
  'Shyambazar',
  'B.B.D. Bagh',
  'Ballygunge',
  'College Street',
  'B.P. Township',
  'Dharmatala',
]

function isValidCitizenZone(zone) {
  return (
    typeof zone === 'string' &&
    CITIZEN_ZONES.includes(zone.trim())
  )
}

module.exports = {
  CITIZEN_ZONES,
  isValidCitizenZone,
}