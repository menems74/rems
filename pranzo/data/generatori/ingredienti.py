# -*- coding: utf-8 -*-
"""Genera data/seed-ingredienti.json.
Tabella compatta: (id, nome, macro, unita, reparto, formato_qta, formato_label,
conversioni, stagioni, famiglia, note)"""
import json, collections

C = lambda *pairs: [{"label": l, "fattore": f} for l, f in pairs]

ING = [
 # ---------------- PROTEINE: carne e salumi (macelleria) ----------------
 ("ing_pollo_petto","Petto di pollo","proteina","g","macelleria",300,"confezione da ~300 g",C(("fetta",120)),[],"pollame",""),
 ("ing_pollo_cosce","Cosce di pollo","proteina","g","macelleria",500,"vassoio da ~500 g",C(("coscia",200)),[],"pollame",""),
 ("ing_tacchino_fesa","Fesa di tacchino","proteina","g","macelleria",300,"confezione da ~300 g",C(("fetta",100)),[],"pollame",""),
 ("ing_manzo_macinato","Macinato di manzo","proteina","g","macelleria",400,"confezione da ~400 g",[],[],"manzo",""),
 ("ing_manzo_fettine","Fettine di manzo","proteina","g","macelleria",300,"confezione da ~300 g",C(("fettina",90)),[],"manzo",""),
 ("ing_maiale_lonza","Lonza di maiale","proteina","g","macelleria",400,"confezione da ~400 g",C(("fetta",120)),[],"maiale",""),
 ("ing_salsiccia","Salsiccia","proteina","g","macelleria",250,"confezione da ~250 g",C(("salsiccia",90)),[],"maiale",""),
 ("ing_pancetta","Pancetta affumicata a cubetti","proteina","g","macelleria",130,"vaschetta da 130 g",[],[],"maiale",""),
 ("ing_prosciutto_cotto","Prosciutto cotto","proteina","g","macelleria",120,"vaschetta da ~120 g",C(("fetta",25)),[],"salumi",""),
 ("ing_prosciutto_crudo","Prosciutto crudo","proteina","g","macelleria",100,"vaschetta da ~100 g",C(("fetta",20)),[],"salumi",""),
 ("ing_bresaola","Bresaola","proteina","g","macelleria",100,"vaschetta da ~100 g",C(("fetta",15)),[],"salumi",""),
 ("ing_speck","Speck","proteina","g","macelleria",100,"vaschetta da ~100 g",C(("fetta",15)),[],"salumi",""),
 ("ing_wurstel","Würstel","proteina","g","macelleria",200,"confezione da 4",C(("wurstel",50)),[],"maiale","per le cene svelte"),
 # ---------------- PROTEINE: pesce ----------------
 ("ing_tonno_scatola","Tonno in scatola sgocciolato","proteina","g","dispensa",160,"2 scatolette da 80 g",C(("scatoletta",80)),[],"pesce",""),
 ("ing_sgombro_scatola","Sgombro in scatola sgocciolato","proteina","g","dispensa",120,"scatoletta da 120 g",C(("scatoletta",120)),[],"pesce",""),
 ("ing_salmone_filetto","Filetto di salmone","proteina","g","pescheria",250,"2 filetti da ~125 g",C(("filetto",125)),[],"pesce",""),
 ("ing_merluzzo_filetto","Filetto di merluzzo","proteina","g","pescheria",300,"2 filetti da ~150 g",C(("filetto",150)),[],"pesce",""),
 ("ing_platessa","Filetto di platessa","proteina","g","surgelati",400,"confezione da 400 g",C(("filetto",100)),[],"pesce",""),
 ("ing_gamberi","Gamberi sgusciati","proteina","g","surgelati",300,"busta da 300 g",[],[],"pesce",""),
 ("ing_alici_marinate","Alici marinate","proteina","g","pescheria",150,"vaschetta da ~150 g",[],[],"pesce",""),
 ("ing_salmone_affumicato","Salmone affumicato","proteina","g","pescheria",100,"confezione da 100 g",C(("fetta",25)),[],"pesce",""),
 # ---------------- PROTEINE: uova, latticini ----------------
 ("ing_uova","Uova","proteina","pz","latticini",6,"confezione da 6",[],[],"uova",""),
 ("ing_mozzarella","Mozzarella","proteina","g","latticini",125,"mozzarella da 125 g",C(("mozzarella",125)),[],"formaggio",""),
 ("ing_ricotta","Ricotta","proteina","g","latticini",250,"vaschetta da 250 g",[],[],"formaggio",""),
 ("ing_stracchino","Stracchino","proteina","g","latticini",100,"confezione da 100 g",[],[],"formaggio",""),
 ("ing_feta","Feta","proteina","g","latticini",200,"confezione da 200 g",[],[],"formaggio",""),
 ("ing_scamorza","Scamorza","proteina","g","latticini",250,"scamorza da ~250 g",[],[],"formaggio",""),
 ("ing_formaggio_fette","Formaggio a fette","proteina","g","latticini",150,"confezione da ~150 g",C(("fetta",22)),[],"formaggio",""),
 ("ing_yogurt_greco","Yogurt greco","proteina","g","latticini",170,"vasetto da 170 g",C(("vasetto",170)),[],"latticini",""),
 ("ing_latte","Latte","proteina","ml","latticini",1000,"bottiglia da 1 l",C(("bicchiere",200)),[],"latticini",""),
 # ---------------- PROTEINE: legumi e vegetali ----------------
 ("ing_ceci_lessati","Ceci lessati","proteina","g","dispensa",240,"barattolo da 400 g (240 g sgocciolati)",C(("barattolo",240)),[],"legumi",""),
 ("ing_cannellini","Fagioli cannellini lessati","proteina","g","dispensa",240,"barattolo da 400 g (240 g sgocciolati)",C(("barattolo",240)),[],"legumi",""),
 ("ing_borlotti","Fagioli borlotti lessati","proteina","g","dispensa",240,"barattolo da 400 g (240 g sgocciolati)",C(("barattolo",240)),[],"legumi",""),
 ("ing_lenticchie","Lenticchie secche","proteina","g","dispensa",500,"confezione da 500 g",[],[],"legumi",""),
 ("ing_tofu","Tofu naturale","proteina","g","dispensa",200,"panetto da 200 g",C(("panetto",200)),[],"legumi",""),
 # ---------------- CARBOIDRATI ----------------
 ("ing_pasta_corta","Pasta corta","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_spaghetti","Spaghetti","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_riso","Riso","carboidrato","g","dispensa",1000,"confezione da 1 kg",[],[],None,""),
 ("ing_riso_venere","Riso venere","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_farro","Farro perlato","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_orzo","Orzo perlato","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_bulgur","Bulgur","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_cous_cous","Cous cous","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_quinoa","Quinoa","carboidrato","g","dispensa",400,"confezione da 400 g",[],[],None,""),
 ("ing_pane","Pane","carboidrato","g","panetteria",500,"pagnotta da ~500 g",C(("fetta",50)),[],None,""),
 ("ing_piadina","Piadina","carboidrato","pz","panetteria",4,"confezione da 4",[],[],None,""),
 ("ing_pane_toast","Pane per toast","carboidrato","g","panetteria",400,"confezione da ~400 g",C(("fetta",25)),[],None,""),
 ("ing_base_pizza","Base per pizza","carboidrato","pz","panetteria",2,"confezione da 2",[],[],None,"la base pronta, da farcire"),
 ("ing_focaccia","Focaccia","carboidrato","g","panetteria",300,"teglia da ~300 g",C(("pezzo",120)),[],None,""),
 ("ing_tortilla","Tortilla di grano","carboidrato","pz","panetteria",6,"confezione da 6",[],[],None,"per i wrap"),
 ("ing_gnocchi","Gnocchi di patate","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_tortellini","Tortellini","carboidrato","g","latticini",250,"confezione da 250 g",[],[],None,"banco frigo"),
 ("ing_patate","Patate","carboidrato","g","ortofrutta",1000,"sacchetto da 1 kg",C(("patata",150)),[],None,""),
 ("ing_polenta","Farina per polenta","carboidrato","g","dispensa",500,"confezione da 500 g",[],[],None,""),
 ("ing_farina","Farina 00","carboidrato","g","dispensa",1000,"confezione da 1 kg",C(("cucchiaio",10)),[],None,""),
 ("ing_pangrattato","Pangrattato","carboidrato","g","dispensa",400,"confezione da 400 g",C(("cucchiaio",10)),[],None,""),
 ("ing_mais","Mais dolce","carboidrato","g","dispensa",150,"barattolo da 150 g sgocciolati",C(("barattolo",150)),[],None,""),
 # ---------------- FIBRE: verdure fresche ----------------
 ("ing_zucchine","Zucchine","fibra","g","ortofrutta",500,"~3 zucchine",C(("zucchina",180)),[],None,""),
 ("ing_melanzane","Melanzane","fibra","g","ortofrutta",500,"2 melanzane",C(("melanzana",250)),[6,7,8,9],None,""),
 ("ing_peperoni","Peperoni","fibra","g","ortofrutta",400,"2 peperoni",C(("peperone",200)),[6,7,8,9],None,""),
 ("ing_pomodorini","Pomodorini","fibra","g","ortofrutta",500,"vassoio da 500 g",[],[],None,""),
 ("ing_pomodori","Pomodori da insalata","fibra","g","ortofrutta",500,"~3 pomodori",C(("pomodoro",150)),[5,6,7,8,9],None,""),
 ("ing_insalata","Insalata mista","fibra","g","ortofrutta",200,"busta da 200 g",[],[],None,""),
 ("ing_rucola","Rucola","fibra","g","ortofrutta",100,"busta da 100 g",[],[],None,""),
 ("ing_spinaci","Spinaci","fibra","g","ortofrutta",300,"busta da 300 g",[],[],None,""),
 ("ing_broccoli","Broccoli","fibra","g","ortofrutta",500,"~1 broccolo",[],[10,11,12,1,2,3],None,""),
 ("ing_cavolfiore","Cavolfiore","fibra","g","ortofrutta",700,"1 cavolfiore",[],[10,11,12,1,2,3],None,""),
 ("ing_verza","Verza","fibra","g","ortofrutta",800,"1 verza",[],[10,11,12,1,2],None,""),
 ("ing_bietole","Bietole","fibra","g","ortofrutta",500,"mazzo da ~500 g",[],[],None,""),
 ("ing_cicoria","Cicoria","fibra","g","ortofrutta",500,"mazzo da ~500 g",[],[10,11,12,1,2,3,4],None,""),
 ("ing_radicchio","Radicchio","fibra","g","ortofrutta",300,"2 cespi",[],[9,10,11,12,1,2],None,""),
 ("ing_fagiolini","Fagiolini","fibra","g","ortofrutta",400,"busta da 400 g",[],[6,7,8,9],None,""),
 ("ing_carote","Carote","fibra","g","ortofrutta",500,"busta da 500 g",C(("carota",80)),[],None,""),
 ("ing_finocchi","Finocchi","fibra","g","ortofrutta",500,"2 finocchi",C(("finocchio",250)),[11,12,1,2,3,4],None,""),
 ("ing_asparagi","Asparagi","fibra","g","ortofrutta",500,"mazzo da 500 g",[],[3,4,5],None,""),
 ("ing_carciofi","Carciofi","fibra","pz","ortofrutta",4,"confezione da 4",[],[11,12,1,2,3,4],None,""),
 ("ing_zucca","Zucca","fibra","g","ortofrutta",600,"fetta da ~600 g",[],[9,10,11,12],None,""),
 ("ing_funghi","Funghi champignon","fibra","g","ortofrutta",250,"vaschetta da 250 g",[],[],None,""),
 ("ing_cetriolo","Cetriolo","fibra","pz","ortofrutta",2,"2 cetrioli",[],[6,7,8,9],None,""),
 ("ing_sedano","Sedano","fibra","g","ortofrutta",300,"1 cespo",C(("costa",60)),[],None,""),
 ("ing_piselli","Piselli","fibra","g","surgelati",450,"busta da 450 g",[],[],None,""),
 ("ing_minestrone","Misto per minestrone","fibra","g","surgelati",450,"busta da 450 g",[],[],None,""),
 # ---------------- FIBRE: pomodoro in dispensa ----------------
 ("ing_pelati","Pomodori pelati","fibra","g","dispensa",400,"barattolo da 400 g",C(("barattolo",400)),[],None,""),
 ("ing_passata","Passata di pomodoro","fibra","ml","dispensa",700,"bottiglia da 700 ml",C(("bicchiere",200)),[],None,""),
 # ---------------- GRASSI ----------------
 ("ing_olio_evo","Olio extravergine di oliva","grasso","ml","dispensa",1000,"bottiglia da 1 l",C(("cucchiaio",10)),[],None,""),
 ("ing_burro","Burro","grasso","g","latticini",250,"panetto da 250 g",C(("noce",15)),[],None,""),
 ("ing_noci","Noci sgusciate","grasso","g","dispensa",200,"confezione da 200 g",[],[],None,""),
 ("ing_pinoli","Pinoli","grasso","g","dispensa",50,"confezione da 50 g",[],[],None,""),
 ("ing_mandorle","Mandorle a lamelle","grasso","g","dispensa",100,"confezione da 100 g",[],[],None,""),
 ("ing_sesamo","Semi di sesamo","grasso","g","dispensa",100,"confezione da 100 g",C(("cucchiaio",10)),[],None,""),
 # ---------------- CONDIMENTI ----------------
 ("ing_cipolla","Cipolla","condimento","pz","ortofrutta",3,"retina da 3",[],[],None,""),
 ("ing_cipolla_rossa","Cipolla rossa","condimento","pz","ortofrutta",3,"retina da 3",[],[],None,""),
 ("ing_aglio","Aglio","condimento","pz","ortofrutta",12,"1 testa, ~12 spicchi",[],[],None,"l'unità è lo spicchio"),
 ("ing_limone","Limone","condimento","pz","ortofrutta",3,"retina da 3",[],[],None,""),
 ("ing_prezzemolo","Prezzemolo","condimento","g","ortofrutta",20,"mazzetto",C(("mazzetto",20)),[],None,""),
 ("ing_basilico","Basilico","condimento","g","ortofrutta",20,"vasetto",C(("foglie",2)),[],None,""),
 ("ing_rosmarino","Rosmarino","condimento","g","ortofrutta",10,"rametto",C(("rametto",5)),[],None,""),
 ("ing_salvia","Salvia","condimento","g","ortofrutta",10,"mazzetto",C(("foglia",1)),[],None,""),
 ("ing_parmigiano","Parmigiano grattugiato","condimento","g","latticini",100,"confezione da 100 g",C(("cucchiaio",10)),[],None,""),
 ("ing_pecorino","Pecorino grattugiato","condimento","g","latticini",100,"confezione da 100 g",C(("cucchiaio",10)),[],None,""),
 ("ing_sale","Sale","condimento","g","dispensa",1000,"confezione da 1 kg",C(("presa",3)),[],None,""),
 ("ing_pepe","Pepe nero","condimento","g","dispensa",50,"macinino da 50 g",[],[],None,""),
 ("ing_aceto","Aceto di vino","condimento","ml","dispensa",500,"bottiglia da 500 ml",C(("cucchiaio",10)),[],None,""),
 ("ing_balsamico","Aceto balsamico","condimento","ml","dispensa",250,"bottiglia da 250 ml",C(("cucchiaio",10)),[],None,""),
 ("ing_senape","Senape","condimento","g","dispensa",200,"vasetto da 200 g",C(("cucchiaino",5)),[],None,""),
 ("ing_maionese","Maionese","condimento","g","dispensa",180,"tubetto da 180 g",C(("cucchiaio",15)),[],None,""),
 ("ing_olive","Olive nere denocciolate","condimento","g","dispensa",150,"vasetto da 150 g",[],[],None,""),
 ("ing_capperi","Capperi","condimento","g","dispensa",100,"vasetto da 100 g",C(("cucchiaio",10)),[],None,""),
 ("ing_pesto","Pesto alla genovese","condimento","g","dispensa",190,"vasetto da 190 g",C(("cucchiaio",20)),[],None,""),
 ("ing_brodo_granulare","Brodo granulare","condimento","g","dispensa",100,"barattolo da 100 g",C(("cucchiaino",5)),[],None,""),
 ("ing_curry","Curry in polvere","condimento","g","dispensa",40,"barattolino da 40 g",C(("cucchiaino",3)),[],None,""),
 ("ing_paprika","Paprika dolce","condimento","g","dispensa",40,"barattolino da 40 g",C(("cucchiaino",3)),[],None,""),
 ("ing_origano","Origano secco","condimento","g","dispensa",20,"barattolino da 20 g",C(("pizzico",1)),[],None,""),
 ("ing_peperoncino","Peperoncino secco","condimento","g","dispensa",20,"barattolino da 20 g",C(("pizzico",1)),[],None,""),
 ("ing_noce_moscata","Noce moscata","condimento","g","dispensa",20,"barattolino da 20 g",C(("grattata",1)),[],None,""),
 ("ing_vino_bianco","Vino bianco","condimento","ml","dispensa",750,"bottiglia da 750 ml",C(("bicchiere",100)),[],None,""),
]

# scorte di credenza: si danno per presenti al primo avvio, altrimenti la
# prima lista della spesa chiede di comprare un chilo di sale per 3 grammi
DISPENSA_BASE = {
 "ing_sale","ing_pepe","ing_olio_evo","ing_aceto","ing_balsamico","ing_senape",
 "ing_curry","ing_paprika","ing_origano","ing_peperoncino","ing_noce_moscata",
 "ing_brodo_granulare","ing_farina","ing_pangrattato",
}

out = []
for (i, nome, macro, unita, reparto, fq, fl, conv, stag, fam, note) in ING:
    ing = {"id": i, "nome": nome, "macro": macro, "unita": unita, "reparto": reparto,
           "formatoAcquisto": {"qta": fq, "label": fl},
           "conversioni": conv, "stagioni": stag, "note": note}
    if fam: ing["famiglia"] = fam
    if i in DISPENSA_BASE: ing["dispensaBase"] = True
    out.append(ing)

# controlli
ids = [x["id"] for x in out]
dup = [k for k,v in collections.Counter(ids).items() if v>1]
assert not dup, dup
REPARTI = {"ortofrutta","macelleria","pescheria","latticini","panetteria","dispensa","surgelati","altro"}
for x in out:
    assert x["reparto"] in REPARTI, x
    assert x["macro"] in {"proteina","carboidrato","fibra","grasso","condimento"}, x
    assert x["unita"] in {"g","ml","pz"}, x
    assert x["formatoAcquisto"]["qta"] > 0, x
    if x["macro"] == "proteina": assert "famiglia" in x, x["id"]

json.dump(out, open("pranzo/data/seed-ingredienti.json","w",encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("ingredienti:", len(out))
print("per macro:", dict(collections.Counter(x["macro"] for x in out)))
print("per reparto:", dict(collections.Counter(x["reparto"] for x in out)))
print("famiglie proteine:", sorted({x["famiglia"] for x in out if x["macro"]=="proteina"}))
