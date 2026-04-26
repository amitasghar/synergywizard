# Path of Exile 2 — Game Mechanics Reference

Purpose: inform UI design decisions, filter choices, synergy prompts, and tag vocabulary for SynergyWizard.

---

## Core Concept

PoE2 is an ARPG where the player builds a character by combining:
1. **Active skill gems** — the abilities you use
2. **Support gems** — modifiers socketed into skill gems that change how they behave
3. **Passive tree** — a massive shared tree of stat nodes and ascendancy specializations
4. **Gear** — weapons and armour that gate which skills are usable and boost stats

The central design goal is **synergy**: skills, supports, passives, ailments, and gear all interact. A build's power comes from stacking multiple systems that reinforce each other.

---

## Classes

PoE2 will have **12 classes** at full release. Each class starts in a different area of the shared passive tree reflecting their attribute focus, and each has **3 ascendancy specializations**.

### Currently Available (Early Access)

| Class | Attributes | Weapon Focus | Ascendancies |
|---|---|---|---|
| Warrior | Strength | Mace, Axe, Sword | Titan, Warbringer, Smith of Kitava |
| Ranger | Dexterity | Bow | Deadeye, Pathfinder |
| Huntress | Dexterity | Spear, Bow | Amazon, Ritualist |
| Witch | Intelligence | Wand, Staff | Infernalist, Blood Mage |
| Sorceress | Intelligence | Staff, Wand | Stormweaver, Chronomancer |
| Mercenary | Str/Dex | Crossbow | Witchhunter, Gemling Legionnaire |
| Monk | Dex/Int | Staff, Unarmed | Invoker, Acolyte of Chayula |
| Druid | Int/Str | Staff | Shaman, Oracle |

### Planned (not yet released)
Templar, Marauder, Duelist, Shadow — completing the 12.

### Key Point for UI
Classes don't gate skill gems — any class can equip any gem if they meet the **attribute requirements** (Str/Dex/Int). Class matters for **passives** and **ascendancy** only. Filters by class therefore only apply to **passives**, not to skills or supports.

---

## Skill Gems

### Equipping
Up to **9 active skill gems** can be equipped simultaneously. Skills live in a dedicated skill window — they are **not socketed into gear** (this is a major change from PoE1).

### Weapon Restrictions
Most active skills require a specific weapon type to function. You can equip the gem without the weapon, but the skill won't activate. Examples:
- Lightning Arrow requires a Bow
- Volcanic Fissure requires a Mace
- Flicker Strike requires a Sword or Dagger
- Fireball requires a Staff or Wand (or no weapon for unarmed casters)

### Gem Colors (Attribute Affinity)
- **Red** — Strength skills: melee attacks, slams, warcries
- **Green** — Dexterity skills: ranged attacks, projectiles, traps, movement
- **Blue** — Intelligence skills: spells, minions, auras, curses, chaos

---

## Support Gems

Each active skill can have up to **5 support gems** socketed into it (starting at 2, expandable with Jeweller's Orbs).

Supports modify the skill they're linked to — they don't activate independently. Examples:
- **Added Fire Damage** — adds fire damage to the linked skill
- **Multiple Projectiles** — fires additional projectiles in a spread
- **Concentrated Effect** — increases AoE damage but reduces area
- **Combustion** — linked fire skill applies a fire resistance debuff on ignite

The same support gem can be socketed into multiple different skills simultaneously.

### Support Tiers (2025 update)
Supports now have tiers — higher tier = better values and sometimes a secondary effect that creates unique interactions.

### Synergy Implication for SynergyWizard
The most powerful PoE2 synergies involve:
1. Choosing an active skill
2. Finding supports that multiply its strengths or unlock new interactions
3. Cross-skill interactions (skill A sets up the condition that skill B exploits)

---

## Weapon Types

### Melee
| Weapon | Attribute | Notes |
|---|---|---|
| Mace (1H/2H) | Strength | Slams, physical/fire, slow but high damage |
| Axe (1H/2H) | Strength | Physical, bleed |
| Sword (1H/2H) | Str/Dex | Balanced, wide skill range |
| Dagger (1H) | Dexterity | Fast, critical hit focused |
| Spear (2H) | Dexterity | New in PoE2, thrust attacks, reach |
| Flail (1H) | Strength | Crowd control |
| Unarmed | — | Monk-specific |

### Ranged
| Weapon | Attribute | Notes |
|---|---|---|
| Bow | Dexterity | Projectile attacks, wide skill support |
| Crossbow | Str/Dex | New in PoE2, bolt mechanics, grenades |

### Caster (off-hand or main-hand)
| Weapon | Attribute | Notes |
|---|---|---|
| Staff (2H) | Intelligence | Spell damage, block chance |
| Wand (1H) | Intelligence | Used with shield, spell damage |
| Sceptre (1H) | Int/Str | Hybrid, elemental/minion |
| Shield (off-hand) | — | Defense, some skills |

---

## Skill Tags

Tags on skills determine which support gems can link to them and how passive nodes interact. A skill can have many tags simultaneously.

### Damage Type Tags
`Fire` `Cold` `Lightning` `Physical` `Chaos`

### Attack/Cast Type Tags
`Attack` `Spell` `Channelling`

### Mechanic Tags
`Slam` `Strike` `Projectile` `Area` `Melee` `Ranged`

### Mobility Tags
`Movement` `Travel` `Blink`

### Utility/Buff Tags
`Aura` `Herald` `Warcry` `Banner` `Stance` `Duration` `Buff`

### Debuff Tags
`Curse` `Mark`

### Summon Tags
`Minion` `Totem` `Trap` `Mine` `Brand` `Golem`

### Special Tags
`Trigger` `Vaal`

### Weapon-Specific Tags
`Bow` `Shield` (skills that require or synergize with specific weapon types)

---

## Status Ailments

Ailments are negative effects applied to enemies. They're a core synergy axis — many builds stack ailment application and then exploit them.

### Elemental Ailments (applied via elemental hits)
| Ailment | Damage Type | Effect | Duration |
|---|---|---|---|
| **Freeze** | Cold | Completely stops enemy movement and actions | 4s default |
| **Chill** | Cold | Slows enemy movement and action speed | Variable |
| **Shock** | Lightning | Enemy takes 20% increased damage | 4s |
| **Electrocute** | Lightning | Stun-like hard CC | Variable |
| **Ignite** | Fire | Fire DoT: 125% of hit's base damage over 4s | 4s |

### Physical/Chaos Ailments
| Ailment | Damage Type | Effect |
|---|---|---|
| **Bleed** | Physical | Physical DoT, worsened by enemy movement |
| **Poison** | Chaos (or Physical) | Chaos DoT, stacks |
| **Stagger** | Physical | Reduces enemy action speed |

### Application Mechanic
Ailments have a **threshold** — the hit must deal a percentage of the enemy's maximum life as the relevant damage type to apply the ailment. Ignite has a 25% base chance per 100% of threshold hit.

---

## Passive Skill Tree

### Structure
- Massive shared tree, all classes share it
- Each class starts in a different section biased toward their attributes
- Nodes: small stat nodes, medium clusters, large notables, keystones

### Keystones
Build-defining unique nodes with major trade-offs. Examples:
- **Resolute Technique** — always hit but can't crit
- **Elemental Equilibrium** — hitting with an element gives resistance to it, vulnerability to others

### Dual-Specialization
PoE2 allows **two passive specializations** that the player can switch between at will. This lets a single character operate as two different builds depending on the situation (e.g. single-target vs AoE loadout).

### Ascendancy Passive Trees
After completing the Trial of Ascendancy, players unlock an ascendancy class with its own small passive tree (typically 8–12 nodes). These nodes are more powerful and build-defining than the main tree. Each ascendancy has a distinct identity:
- **Titan** (Warrior): massive slam damage, armour stacking
- **Warbringer** (Warrior): warcry empowerment, rage mechanics
- **Deadeye** (Ranger): projectile chains, far shot, tailwind stacks
- **Pathfinder** (Ranger): flask sustain, elemental ailment application
- **Invoker** (Monk): elemental invocation, storm/lightning
- **Acolyte of Chayula** (Monk): chaos/void, unarmed
- **Stormweaver** (Sorceress): lightning/storm spells, crit
- **Chronomancer** (Sorceress): time manipulation, cooldown recovery
- **Infernalist** (Witch): fire/chaos, life sacrifice
- **Blood Mage** (Witch): life-based casting, bleed/blood
- **Witchhunter** (Mercenary): anti-magic, exposure
- **Gemling Legionnaire** (Mercenary): gem stacking, attribute scaling
- **Amazon** (Huntress): spear+bow hybrid, crit, evasion
- **Ritualist** (Huntress): elemental stacking, on-hit effects
- **Shaman** (Druid): totems, nature magic
- **Oracle** (Druid): shapeshifting synergies

---

## Core Synergy Patterns

These are the axes along which SynergyWizard should identify synergies:

### 1. Ailment Setup → Exploit
Apply an ailment with one skill, exploit it with another.
- Freeze enemy → shatter with cold hit for massive burst
- Shock enemy → follow up with high lightning damage (+20% taken)
- Ignite enemy → supports/passives that scale burning damage

### 2. Warcry → Empowered Attack
Warcries buff the next skill used. E.g.:
- Seismic Cry → doubles the power of the next Slam
- Intimidating Cry → rage generation for Warbringer

### 3. Trigger Chains
Skills that fire other skills when conditions are met:
- On kill, on crit, on ailment apply, on flask use
- Herald skills trigger effects when you kill enemies

### 4. Support Stacking
Multiple supports on a single skill:
- E.g. Volcanic Fissure + Ignite Proliferation + Burning Damage + Concentrated Effect = massive burning AoE

### 5. Cross-Skill Combos
Skills designed to be used in sequence:
- Druid: human form summons volcanoes → bear form slams to reactivate them
- Sorceress: Frost Bomb (cold exposure) → Spark → Ice Nova (knockback)

### 6. Minion + Master
Minion skills benefit from supports and passives that scale minion damage, speed, and survivability.

### 7. Aura + Active Skills
Reserve mana on auras that permanently buff all skills or all minions.

---

## UI Implications for SynergyWizard

### Filters that make sense for PoE2
- **Weapon type** — mace, bow, sword, staff, wand, crossbow, spear, dagger, axe, unarmed, sceptre (for skills/supports)
- **Class/Ascendancy** — warrior, titan, warbringer, ranger, deadeye, etc. (for passives only)
- **Entity type** — skill, support, passive
- **Mechanic tag** — slam, projectile, aoe, channelling, warcry, minion, trap, etc.
- **Damage type** — fire, cold, lightning, physical, chaos

### Filters that don't make sense for PoE2
- Class filter on skill gems (all gems are class-agnostic, gated only by attributes)

### Synergy search examples users will type
- "What slams work well with warcries?"
- "Fire skills that can ignite reliably"
- "Best supports for Volcanic Fissure"
- "Cold skills that set up freeze shatters"
- "Minion skills for Blood Mage"
- "What passives amplify Titan slam builds?"
