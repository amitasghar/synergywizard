skills["VolcanicFissure"] = {
    name = "Volcanic Fissure",
    color = 1,
    skillTypes = { [SkillType.Slam] = true, [SkillType.Fire] = true, [SkillType.AreaSpell] = true },
    baseMods = { },
    qualityStats = { { "damage_+%_while_active", 20 } },
    stats = {
        "base_skill_effect_duration",
        "fire_damage_+%_final",
    },
}
