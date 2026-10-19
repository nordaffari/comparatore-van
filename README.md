# Comparatore van

Sito statico (GitHub Pages) con due strumenti:

- **Quotatore usato** (`quotatore.html`): valore del camper van usato dal listino attuale, svalutato per età, km, marca e stato. Parametri calibrati da `scripts/calibra.py` su circa 610 annunci AutoScout24 e mobile.de e sui venduti reali Nordaffari (`data/venduti_nordaffari.json`, peso 5×), con una curva separata per i minivan. Dopo aver aggiornato i venduti: `python3 scripts/calibra.py && python3 scripts/costruisci_dati.py`.
- **Comparatore nuovo** (`comparatore.html`): modelli dei principali marchi per lunghezza e disposizione dei letti, con prezzo di listino e confronto fino a 4 modelli.

## Dati

- `data/_sorgente_quotatore.json`: modelli, annunci e parametri del quotatore (sorgente).
- `data/correzioni.json`: correzioni a mano per modello, chiave `"Marca|Nome"` (es. `{"Clever|Drive 540 Fiat": {"disposizione": "letto trasversale", "disposizione_fonte": "verificato"}}`). Vincono sulle regole automatiche.
- `python3 scripts/costruisci_dati.py` rigenera `data/modelli.json`, `data/annunci.json` e `data/parametri.json`.

Sul sito vanno solo prezzi di listino al pubblico: mai prezzi di acquisto o margini concessionario.
