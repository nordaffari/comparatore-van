"""Ricalibra la svalutazione del quotatore su annunci + venduti reali Nordaffari.

Uso: python3 scripts/calibra.py   (poi python3 scripts/costruisci_dati.py)

Modello (come in assets/quotatore.js):
  valore = listino x (1 + optional tipici) x marca x eta x km
Due curve di eta: "van" (furgonati) e "minivan" (Panama, Campster, Vanster, Vanstar).
Il primo anno dei van resta -12% (scelta di Andrea, tarata su Pössl).
Gli annunci sono prezzi richiesti, i venduti sono prezzi reali: un fattore
"annuncio" stima quanto i prezzi richiesti stanno sopra i reali, cosi' la quotazione
esce al livello delle vendite reali. I venduti pesano PESO_VENDUTI volte un annuncio.
"""
import json
import math
import re
from datetime import date
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parent.parent
PESO_VENDUTI = 5.0
S1_VAN = -0.12
KM_A, KM_B = 10000, 7000
OGGI = date(2026, 10, 19)
MARCHE_FATTORE = ["Panama", "Adria", "Hymer", "Knaus", "Malibu", "Weinsberg", "Roadcar", "Clever", "Challenger"]
# Le marche senza molti dati restano vicine a 1 (fattore marca come Pössl)
PRIOR_MARCA = 0.08


def eta(anno, mese):
    return max(0.0, OGGI.year + (OGGI.month - 1) / 12 - (anno + (mese - 0.5) / 12))


def km_attesi(a):
    return KM_A * a if a <= 6 else KM_A * 6 + KM_B * (a - 6)


def minivan(marca, nome):
    return marca == "Panama" or re.match(r"(Campster|Vanster|Vanstar)", nome) is not None


# --- abbinamento annuncio -> modello di listino (porting di bestModel in quotatore.js) ---
ALIAS = [(r"\bglobe ?scout\b", "2win"), (r"\b2 win\b", "2win"), (r"\bbox ?star\b", "boxlife"), (r"\bvan ?tourer\b", "boxlife"),
         (r"\bfreeway\b", "boxlife 630 me"), (r"\bcara ?tour\b", "carabus"), (r"\bcara ?bus\b", "carabus"), (r"\bbox ?life\b", "boxlife"),
         (r"\bbox ?time\b", "boxtime"), (r"\bfree\b", "redwood"), (r"\b(sydney|hymercar)\b", "ayers rock"), (r"\bcharming\b", "comfort"),
         (r"\bsp\b", "spb"), (r"\bspt\b", "spb"), (r"\bsl\b", "slb"), (r"\bjumper\b", "citroen"), (r"\bducato\b", "fiat"),
         (r"\bcitroën\b", "citroen"), (r"\bpössl\b|\bpossl\b", ""), (r"\bp (\d+)\b", r"p\1"), (r"\br (\d{3})\b", r"r\1")]
EXPL = {"relax", "supreme", "sports", "diversity", "first", "family", "kids", "aventuro", "4x4", "ibex", "active", "ibrido",
        "limited", "sport", "fire", "tour", "celebration", "spirit", "gx"}


def norm(t):
    t = " " + re.sub(r"[^a-z0-9àèéìòùöü ]", " ", t.lower()) + " "
    t = re.sub(r"([a-z])(\d{3})\b", r"\1 \2", t)
    t = re.sub(r"\b(\d{3})([a-z]{1,3})\b", r"\1 \2", t)
    for r, v in ALIAS:
        t = re.sub(r, v, t)
    return [w for w in t.split() if not re.match(r"^(19|20)\d\d$", w)
            and not re.match(r"^(van|edition|ps|cv|hp|at|aut|automatik|kastenwagen|camper)$", w)]


def is_len(w):
    return re.match(r"^\d{3}$", w) and 500 <= int(w) <= 699


def score(q, c):
    sc = 0
    cl = [x for x in c if is_len(x)]
    for w in q:
        if is_len(w):
            if not cl:
                continue
            d = min(abs(int(x) - int(w)) for x in cl)
            sc += 4 if d == 0 else 2 if d <= 40 else -2
            continue
        if w.isdigit():
            continue
        if w in c:
            sc += 3 if len(w) >= 3 else 1
        elif len(w) >= 4 and any(len(x) >= 4 and (x.startswith(w) or w.startswith(x)) for x in c):
            sc += 2
    for x in c:
        if x in EXPL and x not in q:
            sc -= 3
    return sc


def abbina_annunci(modelli, righe):
    rep = {}
    for i, m in enumerate(modelli):
        k = m["marca"] + "|" + m["serie"]
        if k not in rep or m["prezzo"] < modelli[rep[k]]["prezzo"]:
            rep[k] = i
    out = []
    for r in righe:
        serie, marca, testo, mmaa, km, prezzo = r[:6]
        b = "Pössl" if marca == "Globecar" else marca
        i = rep.get(b + "|" + serie) if serie else None
        if i is None:
            q = norm(testo)
            best = None
            for j, m in enumerate(modelli):
                if m["marca"] != b:
                    continue
                s = score(q, norm(m["nome"] + " " + m["serie"]))
                if best is None or s > best[0] or (s == best[0] and m["prezzo"] < modelli[best[1]]["prezzo"]):
                    best = (s, j)
            if best is None or best[0] <= 0:
                continue
            i = best[1]
        mm, aa = (int(x) for x in mmaa.split("/"))
        out.append({"i": i, "a": eta(aa, mm), "km": km, "p": prezzo, "w": 1.0, "venduto": False})
    return out


def main():
    src = json.loads((ROOT / "data" / "_sorgente_quotatore.json").read_text())
    # stessi modelli del quotatore (sorgente + marchi aggiunti)
    modelli = json.loads((ROOT / "data" / "modelli.json").read_text())
    idx = {f"{m['marca']}|{m['nome']}": i for i, m in enumerate(modelli)}
    obs = abbina_annunci(modelli, src["rows"])
    vend = json.loads((ROOT / "data" / "venduti_nordaffari.json").read_text())["righe"]
    for chiave, _, anno, km, prezzo in vend:
        obs.append({"i": idx[chiave], "a": eta(anno, 6), "km": km, "p": prezzo, "w": PESO_VENDUTI, "venduto": True})
    obs = [o for o in obs if o["km"] <= 150000 and o["a"] <= 19.5]

    L = np.array([modelli[o["i"]]["prezzo"] for o in obs], float)
    P = np.array([o["p"] for o in obs], float)
    A = np.array([o["a"] for o in obs], float)
    DK = np.array([o["km"] - km_attesi(o["a"]) for o in obs], float) / 1000
    W = np.sqrt(np.array([o["w"] for o in obs], float))
    MV = np.array([minivan(modelli[o["i"]]["marca"], modelli[o["i"]]["nome"]) for o in obs])
    V = np.array([o["venduto"] for o in obs])
    BR = [modelli[o["i"]]["marca"] for o in obs]
    bidx = np.array([MARCHE_FATTORE.index(b) if b in MARCHE_FATTORE else -1 for b in BR])

    # parametri: up, s2, s3, ck, ann, (non usato), s1_m, s2_m, log bf[...]
    # gli optional tipici (up) sono gli stessi per van e minivan: con pochi minivan nuovi
    # up e primo anno minivan non si distinguono
    def unpack(x):
        return dict(up=x[0], s2=x[1], s3=x[2], ck=x[3], ann=x[4], up_m=x[5], s1_m=x[6], s2_m=x[7], lbf=x[8:])

    def logpred(x):
        p = unpack(x)
        van = (np.log(1 + p["up"]) + np.minimum(A, 1) * np.log(1 + S1_VAN)
               + np.clip(A - 1, 0, 5) * np.log(1 + p["s2"]) + np.maximum(A - 6, 0) * np.log(1 + p["s3"]))
        mv = (np.log(1 + p["up"]) + np.minimum(A, 1) * np.log(1 + p["s1_m"]) + np.maximum(A - 1, 0) * np.log(1 + p["s2_m"]))
        lb = np.where(bidx >= 0, p["lbf"][np.maximum(bidx, 0)], 0.0)
        return np.log(L) + np.where(MV, mv, van) + lb + DK * np.log(1 + p["ck"]) + np.where(V, 0.0, np.log(1 + p["ann"]))

    def res(x):
        r = W * (logpred(x) - np.log(P))
        # Panama e minivan Pössl (Campster, Vanster) condividono la curva: il fattore Panama li separa, prior piu' largo
        sd = np.array([0.25 if b == "Panama" else PRIOR_MARCA for b in MARCHE_FATTORE])
        prior = x[8:] / sd * 0.5
        return np.concatenate([r, prior])

    x0 = np.array([0.2, -0.045, -0.05, -0.0016, 0.03, 0.1, -0.15, -0.06] + [0.0] * len(MARCHE_FATTORE))
    lo = [0, -0.15, -0.15, -0.01, -0.2, 0, -0.4, -0.2] + [-0.5] * len(MARCHE_FATTORE)
    hi = [0.4, 0, 0, 0, 0.3, 0.4, 0, 0] + [0.5] * len(MARCHE_FATTORE)
    fit = least_squares(res, x0, bounds=(lo, hi))
    p = unpack(fit.x)
    err = np.exp(logpred(fit.x) - np.log(P)) - 1
    # errore misurato al livello di vendita reale: per gli annunci togliamo il fattore annuncio
    def stats(mask):
        e = np.abs(err[mask])
        return dict(n=int(mask.sum()), err_medio=round(float(e.mean()) * 100, 1), entro10=round(float((e <= 0.10).mean()) * 100))

    def errore_vecchio():
        f, b0 = src["fit"], src["bf"]
        lp = (np.log(L) + np.log(1 + f["up"]) + np.minimum(A, 1) * np.log(1 + f["s1"]) + np.clip(A - 1, 0, 5) * np.log(1 + f["s2"])
              + np.maximum(A - 6, 0) * np.log(1 + f["s3"]) + DK * np.log(1 + f["ck"]) + np.log([b0.get(b, 1) for b in BR]))
        e = np.abs(np.exp(lp - np.log(P)) - 1)
        return {k: round(float(e[m].mean()) * 100, 1) for k, m in (("venduti", V), ("venduti_minivan", V & MV), ("annunci", ~V), ("minivan", MV))}

    bf = {b: round(math.exp(v), 3) for b, v in zip(MARCHE_FATTORE, p["lbf"])}
    out = {
        "fit": {"up": round(p["up"], 3), "s1": S1_VAN, "s2": round(p["s2"], 4), "s3": round(p["s3"], 4), "ck": round(p["ck"], 5)},
        "minivan": {"s1": round(p["s1_m"], 4), "s2": round(p["s2_m"], 4)},
        "annuncio": round(p["ann"], 3),
        "bf": bf,
        "errore_medio_vecchio_modello": errore_vecchio(),
        "qualita": {"tutti": stats(np.ones(len(P), bool)), "venduti": stats(V), "annunci": stats(~V),
                    "minivan": stats(MV), "venduti_minivan": stats(MV & V), "venduti_van": stats(~MV & V)},
    }
    (ROOT / "data" / "calibrazione.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
