"""
Англоязычные подписи для CLIP zero-shot по направлениям (один уровень).
"""

CLIP_LEAVES: list[str] = [
    "roads",
    "transit",
    "pedestrian",
    "utilities",
    "social",
]

CLIP_PROMPTS_EN: dict[str, str] = {
    "roads": (
        "a photo of road problems: potholes, damaged asphalt, traffic jam, "
        "congestion, intersection, crosswalk, street lighting, road signs, or vehicle traffic"
    ),
    "transit": (
        "a photo of public transport: bus stop, tram, trolleybus, bus shelter, "
        "transit station, passengers waiting, or dedicated bus lane"
    ),
    "pedestrian": (
        "a photo of sidewalk, footpath, pedestrian walkway, curb, ramp, stairs, "
        "wheelchair access, mud path, or blocked walking route"
    ),
    "utilities": (
        "a photo of urban utilities: flooding, storm drain, manhole, garbage bins, "
        "trash dump, courtyard lighting, broken lamp post, or waste pile"
    ),
    "social": (
        "a photo of social infrastructure: school, kindergarten, clinic, hospital, "
        "playground, bench, sports ground, or public building"
    ),
}
