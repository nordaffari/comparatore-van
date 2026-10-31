# Comparatore van

Sito statico (GitHub Pages) con due strumenti:

- **Quotatore usato** (`quotatore.html`): valore del camper van usato dal listino attuale, svalutato per età, km, marca e stato. Parametri calibrati da `scripts/calibra.py` su circa 610 annunci AutoScout24 e mobile.de e sui venduti reali Nordaffari (`data/venduti_nordaffari.json`, peso 5×), con una curva separata per i minivan. Dopo aver aggiornato i venduti: `python3 scripts/calibra.py && python3 scripts/costruisci_dati.py`.
- **Comparatore nuovo** (`comparatore.html`): modelli dei principali marchi per lunghezza e disposizione dei letti, con prezzo di listino e confronto fino a 4 modelli.
- **Configuratore guidato** (`guidato.html`): il cliente sceglie lunghezza, letti, bagno, cambio e accessori; a ogni passo restano i van compatibili, con prezzo di partenza, listino barrato e prezzo scontato. Ogni modello si può togliere a mano. La configurazione resta nell'indirizzo della pagina, si può condividere.

## Dati

- `data/_sorgente_quotatore.json`: modelli, annunci e parametri del quotatore (sorgente).
- `data/correzioni.json`: correzioni a mano per modello, chiave `"Marca|Nome"` (es. `{"Clever|Drive 540 Fiat": {"disposizione": "letto trasversale", "disposizione_fonte": "verificato"}}`). Vincono sulle regole automatiche.
- `python3 scripts/costruisci_dati.py` rigenera `data/modelli.json`, `data/annunci.json` e `data/parametri.json`.

Sul sito vanno solo prezzi di listino al pubblico: mai prezzi di acquisto o margini concessionario.

## Configuratore guidato

- `python3 scripts/costruisci_guidato.py [cartella configuratori]` legge i 7 Excel del configuratore nordaffari (F1/F2) e genera `data/guidato.json`: solo i van, con lunghezza, letti, bagno, telaio, prezzo base, cambio automatico, messa in strada e le righe di listino che contengono i 12 accessori qualificanti (riconosciuti dal testo, regole in testa allo script).
- `data/guidato_correzioni.json`: correzioni a mano (bagno, letti, lunghezza) per `"Marca|Modello"`.
- `data/sconti.json`: sconto per il prezzo scontato, predefinito e per marca. La messa in strada non è scontata.
- Prezzo accessori: per ogni van la combinazione di righe più economica che copre tutti gli accessori scelti (un pacchetto conta una volta).
