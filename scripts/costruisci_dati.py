"""Genera i dati del sito (data/*.json) dalla sorgente del quotatore.

Uso: python3 scripts/costruisci_dati.py

Per ogni modello ricava, dove possibile, classe di lunghezza, disposizione dei
letti e telaio. Quando la regola non e' sicura la disposizione resta
"da verificare": le correzioni a mano vanno in data/correzioni.json, che vince
sempre sulle regole.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "_sorgente_quotatore.json"
CORR = ROOT / "data" / "correzioni.json"
EXTRA = ROOT / "data" / "listini_extra.json"

MARCHI_NORDAFFARI = {"Pössl", "Roadcar", "Clever", "Panama", "Challenger", "Dethleffs", "Sunlight"}

# Sigle dei costruttori per la disposizione dei letti (solo quelle certe)
TRASVERSALE = {"MQ", "DB", "SPB"}
LONGITUDINALI = {"ME", "MEG", "LE", "SLB", "ES", "ER"}


def lunghezza(nome, desc):
    m = re.search(r"(\d),(\d\d)\s*m", desc)
    if m:
        cm = int(m.group(1)) * 100 + int(m.group(2))
    else:
        nums = [int(n) for n in re.findall(r"(?<!\d)(\d{3})(?!\d)", nome) if 500 <= int(n) <= 699]
        cm = nums[0] if nums else None
    if "Minivan" in desc:
        return "minivan", None
    if "4x4" in nome or "4x4" in desc or "Sprinter" in desc:
        return "4x4 e Sprinter", cm
    return classe_lunghezza(cm), cm


def classe_layout(testo):
    """Classe di disposizione dal testo del listino (es. "Letti gemelli")."""
    t = (testo or "").lower()
    if "castello" in t:
        return "letti a castello"
    if "gemell" in t or "longitudinal" in t or "singol" in t or "centrale" in t:
        return "letti longitudinali"
    if "trasversal" in t or "francese" in t:
        return "letto trasversale"
    if "living" in t or "servizi" in t:
        return "living o servizi posteriori"
    return "da verificare"


def classe_lunghezza(cm):
    if cm is None:
        return "da verificare"
    if cm <= 560:
        return "5,40 m"
    if cm <= 620:
        return "6,00 m"
    return "6,36 m"


def disposizione(nome, desc):
    d = desc.lower()
    if "trasversale" in d:
        return "letto trasversale", "listino"
    if "longitudinal" in d:
        return "letti longitudinali", "listino"
    if "minivan" in d:
        return "minivan (letto a soffietto)", "listino"
    sigle = set(re.findall(r"\b([A-Z]{2,3})\b", nome))
    if sigle & TRASVERSALE:
        return "letto trasversale", "sigla modello"
    if sigle & LONGITUDINALI:
        return "letti longitudinali", "sigla modello"
    return "da verificare", None


def telaio(marca, nome, desc):
    for t in ("Fiat", "Citroen", "Peugeot", "Mercedes", "Ford", "VW"):
        if t.lower() in nome.lower():
            return t
    if marca == "Panama":
        return "Ford"
    if "Sprinter" in desc:
        return "Mercedes"
    return "n.d."


def fonte(desc):
    if desc.startswith("listino 2026"):
        return "listino 2026 camperonline.it"
    if desc == "stimato dagli annunci":
        return "fuori listino, stimato dagli annunci"
    return "configuratore nordaffari 2027"


def main():
    D = json.loads(SRC.read_text())
    corr = json.loads(CORR.read_text()) if CORR.exists() else {}
    modelli = []
    for i, (marca, nome, prezzo, serie, desc) in enumerate(D["models"]):
        classe, cm = lunghezza(nome, desc)
        disp, disp_fonte = disposizione(nome, desc)
        m = {
            "id": i,
            "marca": marca,
            "nome": nome,
            "serie": serie,
            "gruppo": desc,
            "prezzo": prezzo,
            "lunghezza": classe,
            "lunghezza_cm": cm,
            "disposizione": disp,
            "disposizione_fonte": disp_fonte,
            "telaio": telaio(marca, nome, desc),
            "fonte": fonte(desc),
            "nordaffari": marca in MARCHI_NORDAFFARI,
            "fuori_listino": desc == "stimato dagli annunci",
        }
        modelli.append(m)
    # Marchi aggiunti dai listini pubblici (camperonline.it), con lunghezza e letti dal listino
    for e in json.loads(EXTRA.read_text()) if EXTRA.exists() else []:
        disp = classe_layout(e.get("layout"))
        modelli.append({
            "id": len(modelli),
            "marca": e["marca"],
            "nome": e["nome"],
            "serie": e["serie"],
            "gruppo": e["serie"],
            "prezzo": e["prezzo"],
            "lunghezza": classe_lunghezza(e.get("lunghezza_cm")),
            "lunghezza_cm": e.get("lunghezza_cm"),
            "disposizione": disp,
            "disposizione_fonte": "listino" if disp != "da verificare" else None,
            "telaio": e.get("telaio") or "n.d.",
            "fonte": e.get("fonte", "listino 2026 camperonline.it"),
            "nordaffari": False,
            "fuori_listino": False,
        })
    for m in modelli:
        m.update(corr.get(f"{m['marca']}|{m['nome']}", {}))
    out = ROOT / "data"
    (out / "modelli.json").write_text(json.dumps(modelli, ensure_ascii=False, indent=1))
    (out / "annunci.json").write_text(json.dumps(D["rows"], ensure_ascii=False))
    (out / "parametri.json").write_text(json.dumps({"fit": D["fit"], "bf": D["bf"]}, ensure_ascii=False, indent=1))
    da_ver = sum(m["disposizione"] == "da verificare" for m in modelli)
    print(f"{len(modelli)} modelli, {len(D['rows'])} annunci, disposizione da verificare: {da_ver}")


if __name__ == "__main__":
    main()
