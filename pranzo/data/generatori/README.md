# Generatori dei dati iniziali

I due file `seed-*.json` nella cartella sopra sono generati da questi script,
non scritti a mano: così le quantità restano coerenti e la validazione gira
prima che i dati entrino nel repository.

```
cd pranzo/../          # dalla radice del repository
python3 pranzo/data/generatori/ingredienti.py
python3 pranzo/data/generatori/piatti.py
```

`piatti.py` non si limita a scrivere: verifica che ogni piatto unico copra
davvero proteina, carboidrato e fibra secondo le soglie, che i primi abbiano
un carboidrato, i secondi una proteina e i contorni una fibra, che le unità
usate nelle ricette siano convertibili in quella canonica dell'ingrediente e
che non ci siano id o nomi duplicati. Se qualcosa non torna si ferma e non
scrive niente.

L'app non usa questi script: legge solo i JSON.
