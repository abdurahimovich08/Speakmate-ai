/* Contextual greeting messages for Home page */

interface GreetingContext {
  name: string
  streak: number
  lastSessionHoursAgo: number | null
  level: number
  levelName: string
}

const morningGreetings = [
  'Xayrli tong, {name}! Bugun mashq qilish uchun ajoyib kun.',
  'Ertalab mashq eng samarali, {name}! Boshlaysizmi?',
  'Tonggi energiya — mashqning eng yaxshi vaqti! Keling, {name}.',
  'Xayrli tong! Bugun yangi narsalar o\'rganamiz, {name}.',
]

const afternoonGreetings = [
  'Xayrli kun, {name}! Tushdan keyin mashq — ajoyib tanlov.',
  'Bugungi mashqqa tayyor misiz, {name}?',
  '{name}, kunning ikkinchi yarmi — skill building vaqti!',
]

const eveningGreetings = [
  'Kechqurun mashq eng samarali! Tayyor misiz, {name}?',
  'Xayrli oqshom, {name}! 10 daqiqa — katta farq!',
  'Kunni yaxshi yakunlang — tezkor mashq, {name}!',
]

const streakGreetings = [
  '{streak} kunlik seriya! Ajoyib davom eting, {name}! 🔥',
  'Seriya {streak} kunda! Siz chempionsiz, {name}! 💪',
  '{name}, {streak} kun ketma-ket! Natija ko\'rinyapti!',
]

const comebackGreetings = [
  'Siz sog\'indik, {name}! Qaytganingizdan xursandmiz.',
  'Xush kelibsiz qaytib, {name}! Yangi boshlash — yangi imkoniyat.',
  '{name}, tanaffus bo\'ldi, lekin hozir qaytdingiz — ajoyib!',
]

const levelGreetings = [
  '{name}, siz {levelName} darajasiz! Davom eting!',
  '{levelName} — bu ajoyib maqom, {name}!',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fillTemplate(tpl: string, ctx: GreetingContext): string {
  return tpl
    .replace(/{name}/g, ctx.name)
    .replace(/{streak}/g, String(ctx.streak))
    .replace(/{level}/g, String(ctx.level))
    .replace(/{levelName}/g, ctx.levelName)
}

export function getGreeting(ctx: GreetingContext): string {
  const hour = new Date().getHours()

  // Comeback greeting if absent > 48h
  if (ctx.lastSessionHoursAgo !== null && ctx.lastSessionHoursAgo > 48) {
    return fillTemplate(pick(comebackGreetings), ctx)
  }

  // High streak greeting
  if (ctx.streak >= 5) {
    return fillTemplate(pick(streakGreetings), ctx)
  }

  // Level-based greeting (occasionally)
  if (ctx.level >= 3 && Math.random() < 0.3) {
    return fillTemplate(pick(levelGreetings), ctx)
  }

  // Time-based
  if (hour < 12) return fillTemplate(pick(morningGreetings), ctx)
  if (hour < 17) return fillTemplate(pick(afternoonGreetings), ctx)
  return fillTemplate(pick(eveningGreetings), ctx)
}

export function getMotivationalMessage(): string {
  const messages = [
    'Har bir daqiqa muhim! Keling, boshlaylik.',
    '10 daqiqa — bu katta farq!',
    'Kundalik mashq — professional natija.',
    'Bugun biroz mashq qiling — ertaga farqni ko\'rasiz.',
    'Har bir sessiya sizni maqsadga yaqinlashtiradi.',
    'Doimiy mashq — eng yaxshi strategiya.',
    'Xatolardan qo\'rqmang — ular sizning o\'sishingiz!',
    'Band ballingiz oshyapti — davom eting!',
    'Keling, bugun yangi so\'zlar o\'rganamiz!',
    'Practice makes progress, not perfect!',
  ]
  return pick(messages)
}
