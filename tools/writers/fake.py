"""The stand-in model's answers (llm.Fake): one small, complete story, "Come Over", shaped as each drafting stage would
answer, so the checks and the page's test run the whole writers' room without a model. It doubles as an example of
what a stage should give back."""
import json
import re

BIBLE = {
    "title": "Come Over",
    "logline": "An old friend invites you to her late grandmother's house for the weekend; she still sets three places at the table.",
    "hook": "Everyone has a friend they drifted from, and the guilty yes when she finally calls.",
    "truth": "Hana's grandmother died three weeks ago in the room Hana keeps shut. Hana couldn't face it: she still cooks for her, talks to her through the door, and invited you because she can't carry it alone any more.",
    "ladder": ["a third plate at dinner (she says it's habit)", "the room she keeps shut (the drains, she says)",
               "slippers that moved in the night", "the phone line cut, and a voicemail from her grandmother dated ten days ago",
               "a receipt for funeral flowers never collected", "a tray left outside the shut door each morning",
               "the smell, and the key in the sewing tin"],
    "tone": "warm and ordinary, then held breath; grief, not monsters",
    "setting": "a wooden house at the edge of a country town in late autumn; rain most nights; the last bus at 7:10",
    "player": "you: Hana's friend from university, six years out of touch",
    "time": "dusk",
    "karma": "how much of the truth you let yourself see (and say)",
    "cast": [
        {"id": "hana", "name": "Hana", "subject": "she", "role": "your friend from university", "look": "a dark bob, a cardigan with the sleeves over her hands",
         "wants": "for you to stay the weekend, like old times", "hides": "her grandmother's body in the shut room",
         "tells": "she glances at the shut door before every answer that matters; she smiles a beat too long"},
        {"id": "grandma", "name": "Grandma Kiyo", "subject": "she", "role": "Hana's grandmother, heard only on the answering machine",
         "look": "never seen", "wants": "rest", "hides": "nothing: she asked Hana to let her go", "tells": "a tired, kind voice"}],
    "places": [
        {"id": "genkan", "name": "The entrance", "look": "a narrow genkan, three pairs of shoes, one pair of slippers"},
        {"id": "kitchen", "name": "The kitchen", "look": "a low table set for three, a rice cooker, rain on the window"},
        {"id": "guest_room", "name": "The guest room", "look": "a futon, a sewing tin on the shelf"},
        {"id": "hall", "name": "The hall", "look": "a long corridor, an old landline on a shelf, the shut door at its end"},
        {"id": "grandma_room", "name": "Grandmother's room", "look": "a tatami room behind a sliding door, kept shut"},
        {"id": "living", "name": "The living room", "look": "a low sofa, a kotatsu, photographs on the wall"},
        {"id": "shed", "name": "The shed", "look": "garden tools, chairs stacked under a tarp"}],
}

ENDINGS = [
    {"id": "let_her_rest", "kind": "intended", "title": "Let Her Rest", "what": "Hana opens the door herself and sits by her grandmother. At dawn you phone the doctor together, her head on your shoulder.",
     "how": "you saw the signs, and told her the truth gently at the end", "by": "suggested"},
    {"id": "four_places", "kind": "other", "title": "Four Places", "what": "You agree to keep her secret. The next evening Hana sets four places, and taps the fourth: yours.",
     "how": "you took her side and played along", "by": "suggested"},
    {"id": "last_bus", "kind": "other", "title": "The Last Bus", "what": "You leave before dawn without a word. From the bus you see her at the window, and the shut room's curtain moves.",
     "how": "you chose not to know", "by": "suggested"},
]

RIVER = {
    "acts": [{"id": "a1", "title": "Friday: the invitation"}, {"id": "a2", "title": "Saturday: the house"}, {"id": "a3", "title": "Sunday: the room"}],
    "points": [
        {"id": "p01", "act": "a1", "type": "scene", "title": "The door", "where": "genkan", "who": ["hana"], "minutes": 4,
         "what": "Hana opens the door before you knock, too glad. She hugs you a moment too long and takes your coat.", "player": "arrive, step in, look around", "fork": None},
        {"id": "p02", "act": "a1", "type": "task", "title": "Settling in", "where": "kitchen", "who": ["hana"], "minutes": 6,
         "what": "She asks you to put your bag in the guest room and set the table while she cooks. She hands you three plates.", "player": "the to-do list: the bag, the table (a request)", "fork": None},
        {"id": "p03", "act": "a1", "type": "talk", "title": "Dinner for three", "where": "kitchen", "who": ["hana"], "minutes": 6,
         "what": "Across the low table, the third place stays empty. She says her grandmother liked you.", "player": "answer her, and watch her face", "fork": None},
        {"id": "p04", "act": "a1", "type": "chapter", "title": "The first night", "where": "guest_room", "who": [], "minutes": 2,
         "what": "You sleep on the futon; slippers shuffle in the hall at three. Morning.", "player": "sleep in the guest room", "fork": None},
        {"id": "p05", "act": "a2", "type": "scene", "title": "Slippers", "where": "hall", "who": ["hana"], "minutes": 5,
         "what": "In the morning the slippers by the shut door point the other way. Hana says the house settles.", "player": "notice them", "fork": None},
        {"id": "p06", "act": "a2", "type": "task", "title": "The phone", "where": "hall", "who": [], "minutes": 6,
         "what": "The landline is dead: the cord is cut clean. The answering machine still blinks.", "player": "find the cut cord, play the machine", "fork": None},
        {"id": "p06n", "act": "a2", "type": "chapter", "title": "Rain again", "where": "living", "who": [], "minutes": 1,
         "what": "The day goes by in chores and small talk. Night falls; rain on the windows.", "player": "", "fork": None},
        {"id": "p07", "act": "a2", "type": "talk", "title": "On the sofa", "where": "living", "who": ["hana"], "minutes": 6,
         "what": "Side by side under the kotatsu, she asks if you'll stay till Sunday.", "player": "answer her, close", "fork": None},
        {"id": "p08", "act": "a2", "type": "choice", "title": "Three in the morning", "where": "guest_room", "who": ["hana"], "minutes": 1,
         "what": "Her footsteps pass your door toward the shut room.", "player": "follow her, or stay in bed",
         "fork": {"question": "Follow her?", "ways": [
             {"id": "follow", "label": "Follow her", "sets": "followed", "points": [
                 {"id": "p08a", "type": "scene", "title": "At the door", "where": "hall", "who": ["hana"], "minutes": 4,
                  "what": "She kneels at the shut door, whispering about the weather, and waits for an answer.", "player": "watch from the dark"}]},
             {"id": "stay", "label": "Stay in bed", "sets": "", "points": [
                 {"id": "p08b", "type": "scene", "title": "Through the wall", "where": "guest_room", "who": [], "minutes": 3,
                  "what": "Through the wall, Hana talks softly. Then she laughs, as if someone answered.", "player": "listen"}]}]}},
        {"id": "p08z", "act": "a2", "type": "chapter", "title": "Sunday", "where": "guest_room", "who": [], "minutes": 1,
         "what": "You don't sleep much. Morning comes grey.", "player": "sleep", "fork": None},
        {"id": "p09", "act": "a3", "type": "scene", "title": "Breakfast for three", "where": "kitchen", "who": ["hana"], "minutes": 5,
         "what": "She leaves a tray outside the shut door. The smell is stronger; she blames the drains.", "player": "eat, and watch the tray", "fork": None},
        {"id": "p10", "act": "a3", "type": "task", "title": "The key", "where": "guest_room", "who": [], "minutes": 6,
         "what": "While she's at the shop, you find the key in the sewing tin and open the shut door.", "player": "find the key, open the door", "fork": None},
        {"id": "p11", "act": "a3", "type": "talk", "title": "The doorway", "where": "grandma_room", "who": ["hana"], "minutes": 5,
         "what": "Hana comes home and finds you in the doorway. Face to face, she asks what you saw.", "player": "the last answer", "fork": None}],
    "secrets": [
        {"id": "s_flowers", "after": "p02", "title": "Uncollected", "find": "a receipt in the genkan drawer", "shows": "funeral flowers, ordered three weeks ago, never collected", "achievement": "Uncollected"},
        {"id": "s_message", "after": "p06", "title": "The last message", "find": "the machine's old tape", "shows": "Grandma Kiyo, ten days ago: 'let me rest, little one'", "achievement": "Let Me Rest"},
        {"id": "s_chair", "after": "p09", "title": "A place for you", "find": "under the tarp in the shed", "shows": "a fourth chair with your name taped to it", "achievement": "A Place For You"}],
    "achievements": [
        {"id": "ach_flowers", "title": "Uncollected", "text": "Find what Hana never picked up.", "for": "secret:s_flowers", "hidden": True},
        {"id": "ach_message", "title": "Let Me Rest", "text": "Hear the last message.", "for": "secret:s_message", "hidden": True},
        {"id": "ach_chair", "title": "A Place For You", "text": "Look in the shed.", "for": "secret:s_chair", "hidden": True},
        {"id": "ach_rest", "title": "Let Her Rest", "text": "The intended ending.", "for": "ending:let_her_rest", "hidden": False},
        {"id": "ach_four", "title": "Four Places", "text": "An ending.", "for": "ending:four_places", "hidden": False},
        {"id": "ach_bus", "title": "The Last Bus", "text": "An ending.", "for": "ending:last_bus", "hidden": False},
        {"id": "ach_guest", "title": "Good Guest", "text": "Do every chore she asks.", "for": "feat", "hidden": False}],
    "rules": [{"id": "let_her_rest", "by": "answer", "min": None, "max": None, "point": "p11", "option": "a"},
              {"id": "four_places", "by": "answer", "min": None, "max": None, "point": "p11", "option": "b"},
              {"id": "last_bus", "by": "answer", "min": None, "max": None, "point": "p11", "option": "c"}],
}

DETAILS = {
    "p01": {"shot": "her face in the doorway, close; warm light behind her", "lines": [
        {"who": "hana", "text": "You came. You actually came.", "face": "glad_to_see_you"},
        {"who": "hana", "text": "Six years. You look exactly the same.", "face": "shy_smile"},
        {"who": "hana", "text": "Shoes off. Grandma would kill me.", "face": "deflect_laugh"}], "talk": None, "tasks": [], "chapter": None},
    "p02": {"shot": "the kitchen from the table; Hana at the stove", "lines": [
        {"who": "hana", "text": "Can you set the table? Three plates.", "face": "fake_cheer"}], "talk": None, "tasks": [
        {"id": "bag", "text": "Put your bag in the guest room", "who": "", "done": "the bag is put down in the guest room", "fails": ""},
        {"id": "table", "text": "Set the table for Hana", "who": "hana", "done": "three plates on the table", "fails": ""}], "chapter": None},
    "p03": {"shot": "across the low table, her face at arm's length", "lines": [
        {"who": "hana", "text": "She always liked you, you know.", "face": "memory_soft"}], "talk": {
        "line": {"who": "hana", "text": "She'd have been so happy you're here."}, "listen": "listening_guarded", "options": [
            {"id": "a", "say": "Where is she now?", "face": "lie_glance_away", "tell": "her eyes go to the shut door before she answers", "karma": 1, "sets": "asked_where"},
            {"id": "b", "say": "I'm sorry I never visited.", "face": "relief_too_much", "tell": "the relief is out of proportion: she needed someone to say it", "karma": 0, "sets": ""},
            {"id": "c", "say": "Who's the third plate for?", "face": "fear_flicker", "tell": "fear, then the smile back on, too quickly", "karma": 2, "sets": "asked_plate"}],
        "reveals": "her grandmother isn't 'away': every answer about her goes through the shut door"}, "tasks": [], "chapter": None},
    "p04": {"shot": "lying on the futon, the ceiling, the door's thin line of light", "lines": [], "talk": None, "tasks": [],
            "chapter": {"title": "Saturday", "sub": "07:40", "time": "day"}},
    "p06n": {"shot": "the living room at dusk, the windows streaked", "lines": [], "talk": None, "tasks": [],
             "chapter": {"title": "Saturday night", "sub": "22:10", "time": "night"}},
    "p08z": {"shot": "the guest room ceiling, grey light", "lines": [], "talk": None, "tasks": [],
             "chapter": {"title": "Sunday", "sub": "08:15", "time": "day"}},
    "p05": {"shot": "the hall from the guest room's door; Hana with two cups", "lines": [
        {"who": "hana", "text": "Old houses settle. You get used to it.", "face": "too_still"}], "talk": None, "tasks": [], "chapter": None},
    "p06": {"shot": "the hall shelf, the phone, the blinking light", "lines": [], "talk": None, "tasks": [
        {"id": "cord", "text": "Find why the phone is dead", "who": "", "done": "the cut cord is found", "fails": ""},
        {"id": "machine", "text": "Play the answering machine", "who": "", "done": "the machine is played", "fails": ""}], "chapter": None},
    "p07": {"shot": "side by side under the kotatsu; she turns to you, very close", "lines": [
        {"who": "hana", "text": "This is nice. Like the dorm.", "face": "tired_fond"}], "talk": {
        "line": {"who": "hana", "text": "You'll stay till Sunday, won't you?"}, "listen": "waiting_hopeful", "options": [
            {"id": "a", "say": "Of course I'll stay.", "face": "secret_pleased", "tell": "pleased the way a plan is pleased", "karma": -1, "sets": "promised"},
            {"id": "b", "say": "Hana, what's in that room?", "face": "shock_mask", "tell": "the mask slips: she knows you know something", "karma": 2, "sets": ""},
            {"id": "c", "say": "I should catch the last bus.", "face": "pleading", "tell": "she isn't asking for company; she's asking for help", "karma": 1, "sets": ""}],
        "reveals": "she's not keeping you for herself: she can't face the room alone"}, "tasks": [], "chapter": None},
    "p08": {"shot": "the dark guest room, the hall's light under the door", "lines": [], "talk": None, "tasks": [], "chapter": None},
    "p08a": {"shot": "from the hall's dark end; Hana kneeling at the sliding door", "lines": [
        {"who": "hana", "text": "It's raining again. You'd hate it.", "face": "dissociate"}], "talk": None, "tasks": [], "chapter": None},
    "p08b": {"shot": "the futon, the wall, her voice through it", "lines": [
        {"who": "hana", "text": "I know. I know. Soon.", "face": "listening_to_something"}], "talk": None, "tasks": [], "chapter": None},
    "p09": {"shot": "the kitchen table; the tray by the shut door seen past her", "lines": [
        {"who": "hana", "text": "The drains. I keep meaning to call someone.", "face": "checks_exit"}], "talk": None, "tasks": [], "chapter": None},
    "p10": {"shot": "the guest room shelf, the sewing tin in your hands", "lines": [], "talk": None, "tasks": [
        {"id": "key", "text": "Find the key to the shut room", "who": "", "done": "the key is taken from the sewing tin", "fails": ""},
        {"id": "door", "text": "Open grandmother's room", "who": "", "done": "the sliding door is opened", "fails": "Hana comes home first"}], "chapter": None},
    "p11": {"shot": "the doorway, her face an arm's length away", "lines": [
        {"who": "hana", "text": "You opened it.", "face": "realization"}], "talk": {
        "line": {"who": "hana", "text": "Please. Tell me what you saw."}, "listen": "pleading", "options": [
            {"id": "a", "say": "She's gone, Hana.", "face": "grief_crack", "tell": "she's been waiting three weeks for someone to say it", "karma": 2, "sets": ""},
            {"id": "b", "say": "Nothing. We keep her here.", "face": "smile_wrong", "tell": "her smile comes back, and stays", "karma": -2, "sets": ""},
            {"id": "c", "say": "I have to go.", "face": "resigned", "tell": "she expected it", "karma": 0, "sets": ""}],
        "reveals": "the ending is the truth you say to her face"}, "tasks": [], "chapter": None},
}

FACES = [{"id": "hana_door_wait", "prompt": "she smiles at the viewer, her eyes flick past toward the end of the hall, then come back a little too bright.",
          "secs": 7, "loop": [0.6, 1], "for": "hana"}]


def answer(kind, user):
    """What the stand-in says for a stage; `user` is the stage's request (for the act it asks about)."""
    if kind == "bible":
        return dict(BIBLE, endings=ENDINGS)
    if kind == "endings":
        return {"endings": ENDINGS}
    if kind == "river":
        return RIVER
    if kind == "details":
        act = re.search(r"THE ACT: (\w+)", user)
        act = act.group(1) if act else "a1"
        ids = [p["id"] for p in RIVER["points"] if p["act"] == act]
        ids += [q["id"] for p in RIVER["points"] if p["act"] == act and p.get("fork") for w in p["fork"]["ways"] for q in w["points"]]
        return {"points": [dict(DETAILS[i], id=i) for i in ids if i in DETAILS], "faces": FACES if act == "a2" else []}
    if kind == "chat":
        sel = re.search(r'"selected": "(\w+)"', user)
        sel = sel.group(1) if sel else "p01"
        msg = user[user.rfind("THE USER:"):]
        if "secret" in msg.lower():
            secret = {"id": "s_garden", "after": sel, "title": "The garden", "find": "footprints in the wet garden", "shows": "small slippers' prints, leading to the shed", "achievement": "Footprints"}
            ach = {"id": "ach_garden", "title": "Footprints", "text": "Look at the garden after the rain.", "for": "secret:s_garden", "hidden": True}
            return {"reply": f"I added a secret after {sel}: footprints in the garden, with its achievement.",
                    "changes": [{"op": "add", "what": "secret", "id": "", "after": "", "field": "", "value_json": json.dumps(secret)},
                                {"op": "add", "what": "achievement", "id": "", "after": "", "field": "", "value_json": json.dumps(ach)}]}
        return {"reply": f"{sel} is the point you're looking at; I tightened its summary.",
                "changes": [{"op": "set", "what": "point", "id": sel, "after": "", "field": "what", "value_json": json.dumps("(tightened) " + next(
                    (p["what"] for p in RIVER["points"] if p["id"] == sel), "the point"))}]}
    raise ValueError(kind)
