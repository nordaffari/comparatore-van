"""Genera data/guidato.json per il configuratore guidato (guidato.html).

Uso: python3 scripts/costruisci_guidato.py [cartella dei configuratori]
(predefinita: /mnt/project-files/configuratori)

Legge i file Excel del configuratore nordaffari (F1 modelli, F2 prezzi per
modello: numero = prezzo, 0 = di serie, vuoto = non configurabile) e per ogni
van ricava lunghezza, letti, bagno, telaio, prezzo base, cambio automatico,
messa in strada e gli accessori qualificanti del passo 5.

Le voci accessorio sono riconosciute dal testo della riga: per ogni modello
si prende la riga piu' economica che contiene l'accessorio (0 se di serie).
La riga usata finisce nel JSON, cosi' sul sito si vede da dove viene il prezzo.
Le correzioni a mano (bagno, letti, lunghezza) vanno in
data/guidato_correzioni.json, chiave "Marca|Modello" come nel file F1.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
CARTELLA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/mnt/project-files/configuratori")

FILE = {
    "Challenger": "configuratore-Challenger.xlsx",
    "Clever": "clever/Configuratore-Clever 2027.xlsx",
    "Dethleffs": "configuratore-dethleffs.xlsx",
    "Panama": "Configuratore-PANAMA 2027.xlsx",
    "Pössl": "Configuratore-Possl 2027.xlsx",
    "Roadcar": "configuratore-Roadcar.xlsx",
    "Sunlight": "configuratore-Sunlight.xlsx",
}

# Accessori qualificanti: (id, etichetta, testo che deve esserci, testo da escludere)
ACCESSORI = [
    ("tetto", "Tetto sollevabile", r"tetto (sollevabile|a soffietto)|skyup|cliff rt",
     r"autark|veranda|solare|predispos|maggiorazione|^\*?luce|telo |non con tetto|senza tetto"),
    ("cruise", "Cruise control adattivo", r"cruise|tempomat|\bACC\b", r"^$"),
    ("retrocamera", "Retrocamera", r"retrocamera|telecamera (posteriore|360)|camera di retromarcia|rear view|camera top view",
     r"predispos|precablaggio|seconda retrocamera|obbligatori"),
    ("radio", "Radio con navigatore 10 pollici", r"navigat|infotainment|radio navigation|autoradio|radio touchscreen",
     r"predispos|antenna|senza radio|da 7 pollici"),
    ("solare", "Pannello solare", r"solar", r"predispos|precablaggio|preparazione|senza pannelli|cavi per"),
    ("litio", "Batteria al litio", r"litio|lithium", r"predisposizione per batteria"),
    ("veranda", "Veranda (tendalino)", r"tendalin|veranda|tenda da esterno|tenda da sole",
     r"luce veranda|profilo|guida tendalino"),
    ("diesel", "Riscaldamento a gasolio", r"diesel|gasolio", r"serbatoio|motore|ducato|multijet"),
    ("led", "Fari full LED", r"fa(ri|nali)[^,:]*led|gruppo ottico full led|^\*luci a led",
     r"posterior|xeno|xenon|diurne a led$"),
    ("cerchi", "Cerchi in lega", r"cerchi (in lega|borbet)", r"^[^*]"),
    ("portabici", "Portabici", r"portabici", r"^$"),
    ("gancio", "Gancio traino", r"gancio traino", r"^$"),
]

CAMBIO_AUTO = re.compile(r"cambio automatic|\bAT8\b|automatico a \d", re.I)
CAMBIO_ESCLUDI = re.compile(r"maggiorazione|180 ?cv|clima|commutaz|\bsat\b|impianto|volante|pacchett|pack|assisten|look|obbligator|cerchi|incluso nel|luce", re.I)
MESSA_STRADA = re.compile(r"messa in strada|trasporto, documenti", re.I)
MESSA_ESCLUDI = re.compile(r"supplemento|residenti svizzera", re.I)


def e_van(marca, tipologia):
    t = (tipologia or "").lower()
    if marca in ("Pössl", "Roadcar", "Clever", "Panama"):
        return True
    if marca == "Challenger":
        return t == "van"
    return t.startswith("van")


def telaio(*testi):
    t = " ".join(x or "" for x in testi).lower()
    for nome, chiavi in (("Mercedes", ("mercedes", "sprinter")), ("VW", ("vw", "crafter", "volkswagen")),
                         ("Renault", ("renault", "trafic")), ("Ford", ("ford", "transit", "tourneo")),
                         ("Peugeot", ("peugeot", "boxer")), ("Citroen", ("citroen", "jumper")),
                         ("Fiat", ("fiat", "ducato"))):
        if any(c in t for c in chiavi):
            return nome
    return "n.d."


def lunghezza_cm(marca, tipologia, serie, nome, desc, noti):
    if marca == "Panama":
        return None
    if nome in noti and noti[nome].get("lunghezza_cm"):
        return noti[nome]["lunghezza_cm"]
    for t in (tipologia, serie, desc):
        m = re.search(r"(\d),(\d\d?)\s*m", t or "")
        if m:
            return int(m.group(1)) * 100 + int(m.group(2).ljust(2, "0"))
        m = re.search(r"\b(\d)m\b", t or "")
        if m:
            return int(m.group(1)) * 100
    nums = [int(n) for n in re.findall(r"(?<!\d)(\d{3})(?!\d)", nome) if 500 <= int(n) <= 699]
    return nums[0] if nums else None


def classe_lunghezza(marca, cm):
    if marca == "Panama":
        return "minivan"
    if cm is None:
        return "da verificare"
    if cm <= 560:
        return "540"
    if cm <= 620:
        return "600"
    if cm <= 660:
        return "636"
    return "oltre"


def letti(tipologia, serie, nome, desc, noti):
    t = " ".join(x or "" for x in (serie, desc, nome)).lower()
    if "minivan" in (tipologia or "").lower():
        return "soffietto"
    if re.search(r"castello|sovrappost|doppio letto", t):
        return "castello"
    if re.search(r"dinette in coda|dinette a ferro", t):
        return "dinette"
    if re.search(r"gemell|longitudinal|letti singoli", t):
        return "longitudinali"
    if re.search(r"trasversal|matrimoniale", t):
        return "trasversale"
    d = (noti.get(nome) or {}).get("disposizione", "")
    return {"letto trasversale": "trasversale", "letti longitudinali": "longitudinali",
            "letti a castello": "castello"}.get(d, "da verificare")


def bagno(tipologia, serie, desc):
    t = " ".join(x or "" for x in (tipologia, serie, desc)).lower()
    if "minivan" in t:
        return "con bagno" if "con bagno" in t else "senza"
    if re.search(r"bagno vario|doccia separabile|parete girevole", t):
        return "vario"
    if re.search(r"bagno r\b|doccia separata|bagno centrale", t):
        return "separata"
    if "bagno classico" in t:
        return "classico"
    return "da verificare"


def numero(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def leggi(marca, percorso, noti, corr):
    wb = openpyxl.load_workbook(percorso, data_only=True)
    f1, f2 = wb.worksheets[0], wb.worksheets[1]
    modelli_f1 = [r for r in f1.iter_rows(min_row=2, values_only=True) if r[0] and r[5]]
    intest = [c.value for c in f2[1]]
    colonne = {str(v).strip(): i for i, v in enumerate(intest) if i > 0 and v}
    righe = []
    sezione = None
    for r in f2.iter_rows(min_row=2, values_only=True):
        testo = r[0]
        if testo in ("MECCANICHE", "ACCESSORI"):
            sezione = testo
            continue
        if not testo:
            continue
        righe.append((sezione, str(testo).strip(), r))
    out = []
    for _b, _logo, tip, serie, _f, nome, _fm, desc in [tuple(x[:8]) + (None,) * (8 - len(x[:8])) for x in modelli_f1]:
        nome = str(nome).strip()
        if not e_van(marca, tip) or nome not in colonne:
            continue
        c = colonne[nome]
        base = None
        motore = ""
        voci = []  # (testo, prezzo)
        for sez, testo, r in righe:
            v = numero(r[c]) if c < len(r) else None
            if v is None:
                continue
            if sez == "MECCANICHE":
                if base is None:
                    base, motore = round(v), testo
            elif sez == "ACCESSORI":
                voci.append((testo, round(v)))
        if not base:
            continue
        nome_noto = noti.get(nome) or noti.get(f"{nome} Fiat") or {}
        m = {
            "marca": marca,
            "nome": nome,
            "serie": str(serie or "").strip(),
            "descrizione": str(desc or "").strip(),
            "telaio": telaio(nome, motore),
            "motore": motore,
            "prezzo": base,
        }
        cm = lunghezza_cm(marca, tip, serie, nome, desc, noti)
        m["lunghezza_cm"] = cm
        m["lunghezza"] = classe_lunghezza(marca, cm)
        m["letti"] = letti(tip, serie, nome, desc, noti)
        m["bagno"] = bagno(tip, serie, desc)
        # cambio
        if re.search(r"automatic|\bAT\b", motore, re.I):
            m["cambio"] = {"automatico": 0, "manuale": False, "riga": motore}
        else:
            auto = [(p, t) for t, p in voci if CAMBIO_AUTO.search(t) and not CAMBIO_ESCLUDI.search(t) and p >= 0]
            auto.sort()
            m["cambio"] = {"automatico": auto[0][0] if auto else None, "manuale": True,
                           "riga": auto[0][1].lstrip("*") if auto else None}
        ms = [p for t, p in voci if MESSA_STRADA.search(t) and not MESSA_ESCLUDI.search(t)]
        m["messa_in_strada"] = max(ms) if ms else 0
        # righe utili per gli accessori qualificanti: [testo, prezzo, [accessori coperti]]
        regole = [(aid, re.compile(inc, re.I), re.compile(esc, re.I)) for aid, _l, inc, esc in ACCESSORI]
        viste = set()
        m["righe"] = []
        for t, p in voci:
            if p < 0 or t in viste:
                continue
            cop = [aid for aid, ri, re_ in regole if ri.search(t) and not re_.search(t)]
            if cop:
                viste.add(t)
                m["righe"].append([t.lstrip("*"), p, cop])
        m.update(corr.get(f"{marca}|{nome}", {}))
        out.append(m)
    return out


def main():
    noti = {}
    mj = ROOT / "data" / "modelli.json"
    if mj.exists():
        for x in json.loads(mj.read_text()):
            if x.get("nordaffari"):
                noti[x["nome"]] = x
    cp = ROOT / "data" / "guidato_correzioni.json"
    corr = {k: v for k, v in json.loads(cp.read_text()).items() if not k.startswith("_")} if cp.exists() else {}
    modelli = []
    for marca, f in FILE.items():
        modelli += leggi(marca, CARTELLA / f, noti, corr)
    for i, m in enumerate(modelli):
        m["id"] = i
    dati = {
        "accessori": [{"id": a, "nome": lab} for a, lab, _i, _e in ACCESSORI],
        "modelli": modelli,
    }
    (ROOT / "data" / "guidato.json").write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(modelli)} van")
    for k in ("lunghezza", "letti", "bagno"):
        dv = [f"{m['marca']} {m['nome']}" for m in modelli if m[k] == "da verificare"]
        print(f"{k} da verificare: {len(dv)}", "; ".join(dv))
    senza_auto = [f"{m['marca']} {m['nome']}" for m in modelli if m["cambio"]["automatico"] is None]
    print("senza cambio automatico:", "; ".join(senza_auto))
    for a, lab, _i, _e in ACCESSORI:
        n = [m for m in modelli if any(a in r[2] for r in m["righe"])]
        serie = [m for m in n if any(a in r[2] and r[1] == 0 for r in m["righe"])]
        print(f"{lab}: configurabile su {len(n)}, di serie su {len(serie)}")


if __name__ == "__main__":
    main()
