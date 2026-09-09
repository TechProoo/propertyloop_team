// The colour system.
//
// Lives apart from ui.tsx because that file may only export components —
// mixing components and plain values in one module breaks Fast Refresh.
//
// One hue per area of the business, so a screen is recognisable by colour
// before you read its title: gold for money and deals, green for inventory,
// blue for demand, violet for content, rose for anything wrong, teal for
// conversation.

export type Accent = 'green' | 'gold' | 'blue' | 'violet' | 'rose' | 'teal' | 'ink'

interface AccentStyle {
  /** Saturated tone, for numbers and icons. */
  text: string
  /** Tint, for fills. */
  bg: string
  /** Border at the tint's strength. */
  border: string
  /** Solid fill with legible text on top. */
  solid: string
  /** Gradient for headers and bars. */
  gradient: string
}

export const ACCENT: Record<Accent, AccentStyle> = {
  green: {
    text: 'text-green',
    bg: 'bg-green-soft',
    border: 'border-green/25',
    solid: 'bg-green text-white',
    gradient: 'from-green to-primary-light',
  },
  gold: {
    text: 'text-gold',
    bg: 'bg-gold-soft',
    border: 'border-gold/25',
    solid: 'bg-gold text-white',
    gradient: 'from-gold to-[#d9a44e]',
  },
  blue: {
    text: 'text-blue',
    bg: 'bg-blue-soft',
    border: 'border-blue/25',
    solid: 'bg-blue text-white',
    gradient: 'from-blue to-[#4a8fd4]',
  },
  violet: {
    text: 'text-violet',
    bg: 'bg-violet-soft',
    border: 'border-violet/25',
    solid: 'bg-violet text-white',
    gradient: 'from-violet to-[#9377d6]',
  },
  rose: {
    text: 'text-rose',
    bg: 'bg-rose-soft',
    border: 'border-rose/25',
    solid: 'bg-rose text-white',
    gradient: 'from-rose to-[#d9675c]',
  },
  teal: {
    text: 'text-teal',
    bg: 'bg-teal-soft',
    border: 'border-teal/25',
    solid: 'bg-teal text-white',
    gradient: 'from-teal to-[#2aa8a5]',
  },
  ink: {
    text: 'text-ink',
    bg: 'bg-surface-2',
    border: 'border-line',
    solid: 'bg-ink text-white',
    gradient: 'from-ink-2 to-ink',
  },
}


// A stable colour per person, so faces are distinguishable at a glance in
// message lists and log rows. Hashing the id keeps it consistent everywhere
// without storing a colour on the record.
const AVATAR_ACCENTS: Accent[] = ['green', 'gold', 'blue', 'violet', 'rose', 'teal']

export function avatarAccent(seed: string): Accent {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length]
}

