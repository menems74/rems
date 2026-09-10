# -*- coding: utf-8 -*-
"""Genera data/seed-piatti.json e valida i dati contro le regole delle specifiche."""
import json, collections

# (id, nome, tipo, [(ingrediente, qta, unita)], tempoMin, difficolta, stagioni, [passi], [tags])
P = []
def p(*a): P.append(a)

# ============================== PIATTI UNICI (25) ==============================
p("pia_pasta_tonno_pomodorini","Pasta con tonno e pomodorini","unico",
  [("ing_pasta_corta",100,"g"),("ing_tonno_scatola",1,"scatoletta"),("ing_pomodorini",150,"g"),
   ("ing_aglio",1,"pz"),("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Scalda l'olio con l'aglio, aggiungi i pomodorini tagliati a metà e cuoci 8 minuti.",
   "Unisci il tonno sgocciolato e spegni.","Scola la pasta al dente e mantecala nel condimento."],["padella","veloce"])
p("pia_riso_freddo_tonno","Riso freddo con tonno e mais","unico",
  [("ing_riso",90,"g"),("ing_tonno_scatola",1,"scatoletta"),("ing_mais",60,"g"),
   ("ing_pomodorini",120,"g"),("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Lessa il riso, scolalo e passalo sotto l'acqua fredda.",
   "Condisci con tonno, mais, pomodorini a spicchi, olio e sale."],["freddo","estate"])
p("pia_insalata_ceci_feta","Insalata di ceci e feta","unico",
  [("ing_ceci_lessati",1,"barattolo"),("ing_feta",80,"g"),("ing_pomodorini",150,"g"),
   ("ing_pane",1,"fetta"),("ing_olio_evo",1,"cucchiaio"),("ing_origano",1,"pizzico")],10,1,[],
  ["Sciacqua i ceci e mettili in una ciotola con i pomodorini tagliati.",
   "Aggiungi la feta a cubetti, olio, origano e sale. Servi con il pane."],["freddo","senza cottura"])
p("pia_pasta_fagioli","Pasta e fagioli","unico",
  [("ing_pasta_corta",70,"g"),("ing_borlotti",1,"barattolo"),("ing_passata",100,"ml"),
   ("ing_sedano",1,"costa"),("ing_carote",1,"carota"),("ing_cipolla",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_rosmarino",1,"rametto")],30,2,[10,11,12,1,2,3],
  ["Fai un soffritto di cipolla, carota e sedano con l'olio.",
   "Aggiungi i fagioli con la passata e due dita d'acqua, cuoci 15 minuti.",
   "Butta la pasta nella zuppa e finisci la cottura, aggiungendo acqua se serve."],["zuppa","inverno"])
p("pia_farro_zucchine_mozzarella","Farro con zucchine e mozzarella","unico",
  [("ing_farro",80,"g"),("ing_zucchine",1,"zucchina"),("ing_mozzarella",1,"mozzarella"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_basilico",2,"foglie")],30,1,[],
  ["Lessa il farro per il tempo indicato sulla confezione.",
   "Salta le zucchine a rondelle in padella con olio e sale.",
   "Unisci tutto e aggiungi la mozzarella a cubetti fuori dal fuoco."],["tiepido"])
p("pia_cous_cous_ceci_verdure","Cous cous con ceci e verdure","unico",
  [("ing_cous_cous",80,"g"),("ing_ceci_lessati",1,"barattolo"),("ing_zucchine",120,"g"),
   ("ing_carote",1,"carota"),("ing_olio_evo",1,"cucchiaio"),("ing_curry",1,"cucchiaino")],20,1,[],
  ["Salta zucchine e carote a dadini con olio, curry e sale.",
   "Idrata il cous cous con acqua bollente salata, sgranalo con la forchetta.",
   "Mescola cous cous, verdure e ceci sciacquati."],["veloce"])
p("pia_frittata_zucchine_pane","Frittata di zucchine con pane","unico",
  [("ing_uova",3,"pz"),("ing_zucchine",1,"zucchina"),("ing_parmigiano",1,"cucchiaio"),
   ("ing_pane",1,"fetta"),("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Rosola le zucchine a rondelle in padella con l'olio.",
   "Sbatti le uova con parmigiano e sale, versale sulle zucchine.",
   "Cuoci 4 minuti per lato. Servi con il pane."],["padella","veloce"])
p("pia_pasta_salsiccia_broccoli","Pasta con salsiccia e broccoli","unico",
  [("ing_pasta_corta",90,"g"),("ing_salsiccia",1,"salsiccia"),("ing_broccoli",150,"g"),
   ("ing_aglio",1,"pz"),("ing_olio_evo",1,"cucchiaio"),("ing_peperoncino",1,"pizzico")],25,2,[10,11,12,1,2,3],
  ["Lessa le cime di broccolo nell'acqua della pasta, poi butta la pasta.",
   "Sbriciola la salsiccia in padella con aglio e peperoncino e rosolala.",
   "Manteca pasta e broccoli in padella con un po' d'acqua di cottura."],["inverno"])
p("pia_riso_pollo_verdure","Riso con pollo e verdure","unico",
  [("ing_riso",90,"g"),("ing_pollo_petto",120,"g"),("ing_piselli",80,"g"),
   ("ing_carote",1,"carota"),("ing_olio_evo",1,"cucchiaio"),("ing_brodo_granulare",1,"cucchiaino")],30,2,[],
  ["Lessa il riso. In padella rosola il pollo a striscioline con l'olio.",
   "Aggiungi piselli e carote a dadini con un mestolo di brodo, cuoci 10 minuti.",
   "Unisci il riso e mescola un minuto a fuoco vivo."],["padella"])
p("pia_insalata_riso","Insalata di riso con uova e tonno","unico",
  [("ing_riso",90,"g"),("ing_uova",2,"pz"),("ing_tonno_scatola",1,"scatoletta"),
   ("ing_pomodorini",100,"g"),("ing_olive",20,"g"),("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Lessa il riso e raffreddalo. Rassoda le uova in 9 minuti.",
   "Taglia uova e pomodorini, uniscili al riso con tonno, olive e olio."],["freddo","estate"])
p("pia_polpette_sugo_pane","Polpette al sugo con pane","unico",
  [("ing_manzo_macinato",150,"g"),("ing_pangrattato",2,"cucchiaio"),("ing_uova",1,"pz"),
   ("ing_passata",150,"ml"),("ing_parmigiano",1,"cucchiaio"),("ing_pane",1,"fetta"),
   ("ing_olio_evo",1,"cucchiaio")],35,2,[],
  ["Impasta macinato, pangrattato, uovo, parmigiano e sale; forma 5-6 polpette.",
   "Rosolale nell'olio, poi aggiungi la passata e cuoci coperto 20 minuti.",
   "Servi con il pane per raccogliere il sugo."],["comfort"])
p("pia_zuppa_lenticchie_pane","Zuppa di lenticchie con pane","unico",
  [("ing_lenticchie",90,"g"),("ing_carote",1,"carota"),("ing_sedano",1,"costa"),
   ("ing_cipolla",0.5,"pz"),("ing_pelati",100,"g"),("ing_pane",1,"fetta"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_rosmarino",1,"rametto")],45,2,[10,11,12,1,2,3],
  ["Soffriggi cipolla, carota e sedano tritati.",
   "Aggiungi lenticchie sciacquate, pelati e acqua a coprire; cuoci 35 minuti.",
   "Aggiusta di sale, filo d'olio a crudo e pane abbrustolito."],["zuppa","inverno"])
p("pia_minestrone_orzo","Minestrone con orzo e cannellini","unico",
  [("ing_minestrone",200,"g"),("ing_orzo",60,"g"),("ing_cannellini",120,"g"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_parmigiano",1,"cucchiaio")],35,1,[],
  ["Porta a bollore il misto per minestrone con acqua salata.",
   "Aggiungi l'orzo e cuoci 25 minuti, poi i cannellini negli ultimi 5.",
   "Completa con olio a crudo e parmigiano."],["zuppa"])
p("pia_piadina_bresaola","Piadina con bresaola e stracchino","unico",
  [("ing_piadina",1,"pz"),("ing_bresaola",80,"g"),("ing_stracchino",50,"g"),("ing_rucola",40,"g")],10,1,[],
  ["Scalda la piadina in padella un minuto per lato.",
   "Spalma lo stracchino, farcisci con bresaola e rucola, piega e taglia."],["veloce","senza fornelli"])
p("pia_uova_spinaci_pane","Uova strapazzate con spinaci e pane","unico",
  [("ing_uova",3,"pz"),("ing_spinaci",150,"g"),("ing_pane",1,"fetta"),("ing_burro",1,"noce")],15,1,[],
  ["Fai stufare gli spinaci in padella con il burro e un pizzico di sale.",
   "Versa le uova sbattute e mescola a fuoco basso finché rassodano.",
   "Servi sul pane tostato."],["veloce"])
p("pia_pasta_melanzane_ricotta","Pasta con melanzane e ricotta","unico",
  [("ing_pasta_corta",90,"g"),("ing_melanzane",200,"g"),("ing_ricotta",100,"g"),
   ("ing_passata",100,"ml"),("ing_olio_evo",1,"cucchiaio"),("ing_basilico",2,"foglie")],30,2,[6,7,8,9],
  ["Rosola le melanzane a cubetti nell'olio finché dorate.",
   "Aggiungi la passata e cuoci 10 minuti.",
   "Condisci la pasta e completa con la ricotta a cucchiaiate e il basilico."],["estate"])
p("pia_riso_venere_gamberi","Riso venere con gamberi e zucchine","unico",
  [("ing_riso_venere",80,"g"),("ing_gamberi",120,"g"),("ing_zucchine",150,"g"),
   ("ing_limone",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],35,2,[],
  ["Lessa il riso venere (circa 30 minuti).",
   "Salta zucchine a dadini e gamberi in padella con olio, sale e scorza di limone.",
   "Mescola al riso e servi tiepido."],["tiepido"])
p("pia_bulgur_feta_verdure","Bulgur con feta e verdure","unico",
  [("ing_bulgur",80,"g"),("ing_feta",100,"g"),("ing_peperoni",150,"g"),
   ("ing_cipolla_rossa",0.5,"pz"),("ing_olio_evo",1,"cucchiaio"),("ing_prezzemolo",1,"mazzetto")],25,1,[6,7,8,9],
  ["Cuoci il bulgur in acqua salata per 12 minuti e scolalo.",
   "Griglia i peperoni a listarelle in padella con la cipolla.",
   "Unisci tutto con feta a cubetti, olio e prezzemolo."],["estate","tiepido"])
p("pia_quinoa_ceci_spinaci","Quinoa con ceci e spinaci","unico",
  [("ing_quinoa",80,"g"),("ing_ceci_lessati",1,"barattolo"),("ing_spinaci",100,"g"),
   ("ing_limone",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Sciacqua la quinoa e cuocila 15 minuti in acqua salata.",
   "Fai cadere gli spinaci in padella con olio, poi unisci i ceci.",
   "Mescola alla quinoa con succo di limone e sale."],["proteico"])
p("pia_gnocchi_pomodoro_mozzarella","Gnocchi al pomodoro e mozzarella","unico",
  [("ing_gnocchi",250,"g"),("ing_passata",150,"ml"),("ing_mozzarella",1,"mozzarella"),
   ("ing_basilico",2,"foglie"),("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Scalda la passata con olio, sale e basilico per 10 minuti.",
   "Lessa gli gnocchi: sono pronti quando vengono a galla.",
   "Condisci e aggiungi la mozzarella a cubetti, che si scioglie appena."],["comfort"])
p("pia_zuppa_ceci_pasta","Zuppa di ceci e pasta","unico",
  [("ing_ceci_lessati",1,"barattolo"),("ing_pasta_corta",60,"g"),("ing_pelati",100,"g"),
   ("ing_aglio",1,"pz"),("ing_rosmarino",1,"rametto"),("ing_olio_evo",1,"cucchiaio")],25,1,[10,11,12,1,2,3],
  ["Rosola aglio e rosmarino nell'olio, aggiungi ceci e pelati schiacciati.",
   "Copri d'acqua, porta a bollore e frulla metà zuppa.",
   "Cuoci la pasta direttamente nella zuppa."],["zuppa","inverno"])
p("pia_insalatona_pollo","Insalatona di pollo","unico",
  [("ing_insalata",150,"g"),("ing_pollo_petto",150,"g"),("ing_mais",60,"g"),
   ("ing_pomodorini",100,"g"),("ing_pane",1,"fetta"),("ing_olio_evo",1,"cucchiaio"),
   ("ing_balsamico",1,"cucchiaio")],20,1,[],
  ["Cuoci il pollo a fettine in padella con poco olio e sale.",
   "Componi l'insalata con pomodorini e mais, aggiungi il pollo tiepido.",
   "Condisci con olio e balsamico, servi con il pane."],["freddo","proteico"])
p("pia_frittata_patate","Frittata di patate e cipolla con insalata","unico",
  [("ing_uova",3,"pz"),("ing_patate",200,"g"),("ing_cipolla",0.5,"pz"),
   ("ing_insalata",80,"g"),("ing_olio_evo",2,"cucchiaio")],30,2,[],
  ["Rosola le patate a fettine sottili con la cipolla, coperte, per 15 minuti.",
   "Versa le uova sbattute e sale, cuoci 5 minuti per lato.",
   "Servi con l'insalata condita."],["comfort"])
p("pia_vellutata_zucca_farro","Vellutata di zucca con farro e stracchino","unico",
  [("ing_zucca",300,"g"),("ing_farro",60,"g"),("ing_stracchino",100,"g"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_salvia",2,"foglia")],35,2,[9,10,11,12],
  ["Cuoci la zucca a cubetti con acqua a filo e sale, poi frulla.",
   "Lessa il farro a parte e uniscilo alla vellutata.",
   "Completa con stracchino a cucchiaiate, olio e salvia."],["autunno","zuppa"])
p("pia_pasta_puttanesca_tonno","Pasta alla puttanesca con tonno","unico",
  [("ing_spaghetti",90,"g"),("ing_tonno_scatola",1,"scatoletta"),("ing_pelati",200,"g"),
   ("ing_olive",30,"g"),("ing_capperi",1,"cucchiaio"),("ing_aglio",1,"pz"),
   ("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Rosola aglio, olive e capperi nell'olio.",
   "Aggiungi i pelati schiacciati e cuoci 10 minuti, poi il tonno.",
   "Salta gli spaghetti nel sugo."],["padella"])

# ================================= PRIMI (20) =================================
p("pia_pasta_pomodoro","Pasta al pomodoro e basilico","primo",
  [("ing_pasta_corta",100,"g"),("ing_passata",150,"ml"),("ing_aglio",1,"pz"),
   ("ing_basilico",3,"foglie"),("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Scalda olio e aglio, aggiungi la passata e cuoci 10 minuti con sale.",
   "Condisci la pasta e aggiungi il basilico a crudo."],["base","veloce"])
p("pia_pasta_pesto","Pasta al pesto","primo",
  [("ing_pasta_corta",100,"g"),("ing_pesto",2,"cucchiaio"),("ing_parmigiano",1,"cucchiaio")],15,1,[],
  ["Lessa la pasta.","Diluisci il pesto con due cucchiai di acqua di cottura e condisci fuori dal fuoco."],["veloce"])
p("pia_pasta_cacio_pepe","Pasta cacio e pepe","primo",
  [("ing_spaghetti",100,"g"),("ing_pecorino",30,"g"),("ing_pepe",1,"g")],15,2,[],
  ["Tosta il pepe in padella con un mestolo di acqua di cottura.",
   "Manteca gli spaghetti con il pecorino sciolto nell'acqua, fuori dal fuoco."],["veloce"])
p("pia_aglio_olio","Spaghetti aglio, olio e peperoncino","primo",
  [("ing_spaghetti",100,"g"),("ing_aglio",2,"pz"),("ing_olio_evo",2,"cucchiaio"),
   ("ing_peperoncino",1,"pizzico"),("ing_prezzemolo",1,"mazzetto")],15,1,[],
  ["Imbiondisci aglio e peperoncino nell'olio senza bruciarli.",
   "Salta gli spaghetti con un po' d'acqua di cottura e prezzemolo."],["base","veloce"])
p("pia_spaghetti_zucchine_limone","Spaghetti con zucchine e limone","primo",
  [("ing_spaghetti",90,"g"),("ing_zucchine",1,"zucchina"),("ing_limone",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_parmigiano",1,"cucchiaio")],20,1,[],
  ["Salta le zucchine a julienne con olio e sale.",
   "Manteca gli spaghetti con zucchine, scorza di limone e parmigiano."],["veloce"])
p("pia_pasta_fredda_olive","Pasta fredda con pomodorini, olive e basilico","primo",
  [("ing_pasta_corta",90,"g"),("ing_pomodorini",150,"g"),("ing_olive",30,"g"),
   ("ing_basilico",3,"foglie"),("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Lessa la pasta e raffreddala sotto l'acqua.",
   "Condisci con pomodorini a spicchi, olive, olio, sale e basilico."],["freddo","estate"])
p("pia_risotto_funghi","Risotto ai funghi","primo",
  [("ing_riso",90,"g"),("ing_funghi",200,"g"),("ing_cipolla",0.5,"pz"),
   ("ing_brodo_granulare",1,"cucchiaino"),("ing_burro",1,"noce"),("ing_parmigiano",1,"cucchiaio")],30,2,[],
  ["Rosola la cipolla tritata, aggiungi i funghi a fette e cuoci 8 minuti.",
   "Tosta il riso, poi cuoci aggiungendo brodo caldo un mestolo alla volta.",
   "Manteca con burro e parmigiano a fuoco spento."],["classico"])
p("pia_risotto_asparagi","Risotto agli asparagi","primo",
  [("ing_riso",90,"g"),("ing_asparagi",200,"g"),("ing_cipolla",0.5,"pz"),
   ("ing_brodo_granulare",1,"cucchiaino"),("ing_parmigiano",1,"cucchiaio")],30,2,[3,4,5],
  ["Taglia gli asparagi tenendo da parte le punte.",
   "Tosta il riso col soffritto, cuoci col brodo aggiungendo gli asparagi.",
   "Unisci le punte negli ultimi 5 minuti e manteca col parmigiano."],["primavera"])
p("pia_pasta_patate","Pasta e patate","primo",
  [("ing_pasta_corta",70,"g"),("ing_patate",200,"g"),("ing_passata",50,"ml"),
   ("ing_cipolla",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],30,2,[],
  ["Soffriggi la cipolla, aggiungi le patate a cubetti e la passata.",
   "Copri d'acqua, cuoci 15 minuti, poi butta la pasta nella pentola.",
   "Lascia riposare due minuti: deve restare morbida, non asciutta."],["comfort","zuppa"])
p("pia_pasta_broccoli","Pasta con i broccoli","primo",
  [("ing_pasta_corta",90,"g"),("ing_broccoli",200,"g"),("ing_aglio",1,"pz"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_peperoncino",1,"pizzico")],25,1,[10,11,12,1,2,3],
  ["Lessa i broccoli, poi cuoci la pasta nella stessa acqua.",
   "Ripassa i broccoli in padella con aglio, olio e peperoncino, schiacciandoli.",
   "Manteca la pasta nel condimento."],["inverno"])
p("pia_orzo_freddo_pomodorini","Orzo freddo con pomodorini e rucola","primo",
  [("ing_orzo",80,"g"),("ing_pomodorini",120,"g"),("ing_rucola",40,"g"),
   ("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Lessa l'orzo 25 minuti, scolalo e raffreddalo.",
   "Condisci con pomodorini, rucola spezzettata, olio e sale."],["freddo"])
p("pia_farro_pesto_fagiolini","Farro con pesto e fagiolini","primo",
  [("ing_farro",80,"g"),("ing_fagiolini",120,"g"),("ing_pesto",1,"cucchiaio"),
   ("ing_olio_evo",1,"cucchiaio")],30,1,[6,7,8,9],
  ["Lessa il farro e i fagiolini nella stessa pentola (i fagiolini negli ultimi 10 minuti).",
   "Condisci con il pesto diluito con un cucchiaio d'acqua."],["tiepido"])
p("pia_tortellini_brodo","Tortellini in brodo","primo",
  [("ing_tortellini",125,"g"),("ing_brodo_granulare",1,"cucchiaino"),("ing_parmigiano",1,"cucchiaio")],12,1,[10,11,12,1,2,3],
  ["Porta a bollore mezzo litro di brodo.",
   "Cuoci i tortellini 4 minuti e servi con il parmigiano."],["veloce","inverno"])
p("pia_pasta_norma","Pasta alla Norma","primo",
  [("ing_pasta_corta",90,"g"),("ing_melanzane",200,"g"),("ing_passata",150,"ml"),
   ("ing_parmigiano",1,"cucchiaio"),("ing_olio_evo",2,"cucchiaio"),("ing_basilico",3,"foglie")],30,2,[6,7,8,9],
  ["Friggi le melanzane a cubetti nell'olio e tienile da parte.",
   "Cuoci la passata 10 minuti con sale e basilico.",
   "Condisci la pasta, unisci le melanzane e il formaggio grattugiato."],["estate"])
p("pia_pasta_radicchio_noci","Pasta con radicchio e noci","primo",
  [("ing_pasta_corta",90,"g"),("ing_radicchio",150,"g"),("ing_noci",20,"g"),
   ("ing_olio_evo",1,"cucchiaio")],20,1,[9,10,11,12,1,2],
  ["Stufa il radicchio a listarelle in padella con olio e sale.",
   "Manteca la pasta con il radicchio e le noci tritate grossolanamente."],["autunno"])
p("pia_riso_curry_piselli","Riso al curry con piselli","primo",
  [("ing_riso",90,"g"),("ing_piselli",120,"g"),("ing_curry",1,"cucchiaino"),
   ("ing_cipolla",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Rosola la cipolla con il curry, aggiungi i piselli e mezzo bicchiere d'acqua.",
   "Cuoci 10 minuti e mescola al riso lessato."],["veloce"])
p("pia_cous_cous_verdure","Cous cous alle verdure","primo",
  [("ing_cous_cous",80,"g"),("ing_zucchine",120,"g"),("ing_carote",1,"carota"),
   ("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Taglia le verdure a dadini piccoli e saltale con olio e sale.",
   "Idrata il cous cous con pari volume di acqua bollente, sgranalo e unisci le verdure."],["veloce"])
p("pia_pasta_zucca","Pasta con la zucca e rosmarino","primo",
  [("ing_pasta_corta",90,"g"),("ing_zucca",250,"g"),("ing_cipolla",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_rosmarino",1,"rametto")],30,2,[9,10,11,12],
  ["Stufa la zucca a cubetti con cipolla, rosmarino e poca acqua fino a disfarsi.",
   "Condisci la pasta con la crema di zucca e un filo d'olio."],["autunno","comfort"])
p("pia_minestra_verdure_pasta","Minestra di verdure con pasta","primo",
  [("ing_minestrone",200,"g"),("ing_pasta_corta",50,"g"),("ing_olio_evo",1,"cucchiaio"),
   ("ing_parmigiano",1,"cucchiaio")],30,1,[],
  ["Cuoci le verdure in acqua salata per 20 minuti.",
   "Aggiungi la pasta e portala a cottura nella minestra.",
   "Olio a crudo e parmigiano."],["zuppa"])
p("pia_gnocchi_pomodoro","Gnocchi al pomodoro","primo",
  [("ing_gnocchi",250,"g"),("ing_passata",150,"ml"),("ing_basilico",3,"foglie"),
   ("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Scalda la passata con olio e sale per 10 minuti.",
   "Lessa gli gnocchi e condiscili appena vengono a galla."],["veloce","comfort"])

# ================================ SECONDI (20) ================================
p("pia_pollo_limone","Pollo al limone","secondo",
  [("ing_pollo_petto",150,"g"),("ing_limone",0.5,"pz"),("ing_farina",1,"cucchiaio"),
   ("ing_olio_evo",1,"cucchiaio"),("ing_prezzemolo",1,"mazzetto")],20,1,[],
  ["Taglia il petto a fettine e infarinale leggermente.",
   "Rosolale nell'olio 2 minuti per lato, poi sfuma con il succo di limone.",
   "Sale, prezzemolo e via dal fuoco."],["padella","veloce"])
p("pia_pollo_paprika","Petto di pollo alla paprika","secondo",
  [("ing_pollo_petto",150,"g"),("ing_paprika",1,"cucchiaino"),("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Condisci il pollo a fette con paprika, sale e olio.",
   "Cuocilo in padella ben calda 3 minuti per lato."],["padella","veloce"])
p("pia_cosce_forno","Cosce di pollo al forno con rosmarino","secondo",
  [("ing_pollo_cosce",1,"coscia"),("ing_rosmarino",1,"rametto"),("ing_olio_evo",1,"cucchiaio")],45,1,[],
  ["Condisci la coscia con olio, sale e rosmarino.",
   "Cuoci in forno a 200° per 40 minuti, girandola a metà."],["forno","senza pensieri"])
p("pia_tacchino_erbe","Fesa di tacchino alle erbe","secondo",
  [("ing_tacchino_fesa",150,"g"),("ing_origano",1,"pizzico"),("ing_limone",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Scalda la padella con l'olio e cuoci le fette 3 minuti per lato.",
   "Condisci con origano, sale e succo di limone."],["padella","veloce"])
p("pia_fettine_pomodoro","Fettine di manzo al pomodoro","secondo",
  [("ing_manzo_fettine",2,"fettina"),("ing_passata",150,"ml"),("ing_origano",1,"pizzico"),
   ("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Rosola le fettine un minuto per lato nell'olio.",
   "Aggiungi la passata, origano e sale; cuoci coperto 15 minuti."],["padella"])
p("pia_polpette_sugo","Polpette al sugo","secondo",
  [("ing_manzo_macinato",150,"g"),("ing_pangrattato",2,"cucchiaio"),("ing_uova",1,"pz"),
   ("ing_passata",150,"ml"),("ing_parmigiano",1,"cucchiaio"),("ing_olio_evo",1,"cucchiaio")],35,2,[],
  ["Impasta carne, pangrattato, uovo, parmigiano e sale.",
   "Forma le polpette, rosolale e cuocile nella passata 20 minuti."],["comfort"])
p("pia_lonza_latte","Lonza di maiale al latte","secondo",
  [("ing_maiale_lonza",150,"g"),("ing_latte",1,"bicchiere"),("ing_salvia",2,"foglia"),
   ("ing_farina",1,"cucchiaio"),("ing_burro",1,"noce")],40,2,[],
  ["Infarina la carne e rosolala nel burro con la salvia.",
   "Copri col latte e cuoci coperto 30 minuti a fuoco basso.",
   "Togli la carne e riduci il fondo due minuti."],["comfort"])
p("pia_salsiccia_cipolle","Salsiccia con cipolle","secondo",
  [("ing_salsiccia",2,"salsiccia"),("ing_cipolla",1,"pz"),("ing_vino_bianco",1,"bicchiere"),
   ("ing_olio_evo",1,"cucchiaio")],30,1,[],
  ["Rosola le salsicce punzecchiate in padella con l'olio.",
   "Aggiungi la cipolla a fette e sfuma col vino.",
   "Cuoci coperto 20 minuti, finché la cipolla è morbida."],["padella"])
p("pia_frittata_parmigiano","Frittata al parmigiano","secondo",
  [("ing_uova",3,"pz"),("ing_parmigiano",2,"cucchiaio"),("ing_olio_evo",1,"cucchiaio")],10,1,[],
  ["Sbatti le uova con parmigiano, sale e pepe.",
   "Versa in padella calda e cuoci 3 minuti per lato."],["veloce"])
p("pia_uova_purgatorio","Uova al pomodoro","secondo",
  [("ing_uova",2,"pz"),("ing_pelati",200,"g"),("ing_aglio",1,"pz"),
   ("ing_basilico",2,"foglie"),("ing_olio_evo",1,"cucchiaio")],20,1,[],
  ["Cuoci i pelati schiacciati con aglio, olio e sale per 10 minuti.",
   "Apri due incavi nel sugo, rompici le uova e copri 5 minuti."],["padella","comfort"])
p("pia_merluzzo_patate","Merluzzo al forno con patate","secondo",
  [("ing_merluzzo_filetto",1,"filetto"),("ing_patate",200,"g"),("ing_rosmarino",1,"rametto"),
   ("ing_olio_evo",1,"cucchiaio")],35,2,[],
  ["Disponi le patate a fettine in teglia con olio, sale e rosmarino; 15 minuti a 200°.",
   "Appoggia il filetto sopra e cuoci altri 15 minuti."],["forno"])
p("pia_platessa_impanata","Platessa impanata al forno","secondo",
  [("ing_platessa",2,"filetto"),("ing_pangrattato",3,"cucchiaio"),("ing_limone",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Passa i filetti nel pangrattato con sale e un filo d'olio.",
   "Cuoci in forno a 200° per 15 minuti. Servi con il limone."],["forno","veloce"])
p("pia_salmone_forno","Salmone al forno con limone","secondo",
  [("ing_salmone_filetto",1,"filetto"),("ing_limone",0.5,"pz"),("ing_olio_evo",1,"cucchiaio"),
   ("ing_prezzemolo",1,"mazzetto")],25,1,[],
  ["Condisci il filetto con olio, sale e fette di limone.",
   "Forno a 190° per 15 minuti, poi prezzemolo fresco."],["forno"])
p("pia_gamberi_aglio","Gamberi in padella con aglio","secondo",
  [("ing_gamberi",150,"g"),("ing_aglio",2,"pz"),("ing_vino_bianco",1,"bicchiere"),
   ("ing_prezzemolo",1,"mazzetto"),("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Scalda olio e aglio, butta i gamberi e cuoci 3 minuti.",
   "Sfuma col vino, sale e prezzemolo."],["padella","veloce"])
p("pia_sgombro_cipolla","Sgombro con cipolla rossa","secondo",
  [("ing_sgombro_scatola",1,"scatoletta"),("ing_cipolla_rossa",0.5,"pz"),
   ("ing_aceto",1,"cucchiaio"),("ing_olio_evo",1,"cucchiaio")],10,1,[],
  ["Affetta la cipolla fine e lasciala 5 minuti in acqua e aceto.",
   "Sgocciolala e uniscila allo sgombro con olio e pepe."],["senza cottura","veloce"])
p("pia_caprese","Mozzarella e pomodori","secondo",
  [("ing_mozzarella",1,"mozzarella"),("ing_pomodori",150,"g"),("ing_basilico",3,"foglie"),
   ("ing_olio_evo",1,"cucchiaio")],8,1,[5,6,7,8,9],
  ["Affetta pomodori e mozzarella.",
   "Alterna sul piatto, condisci con olio, sale e basilico."],["senza cottura","estate"])
p("pia_sformato_ricotta_spinaci","Sformato di ricotta e spinaci","secondo",
  [("ing_ricotta",150,"g"),("ing_spinaci",200,"g"),("ing_uova",1,"pz"),
   ("ing_parmigiano",1,"cucchiaio"),("ing_noce_moscata",1,"grattata")],40,2,[],
  ["Stufa gli spinaci, strizzali e tritali.",
   "Mescola con ricotta, uovo, parmigiano, sale e noce moscata.",
   "Inforna in stampo unto a 180° per 25 minuti."],["forno"])
p("pia_feta_forno_pomodorini","Feta al forno con pomodorini","secondo",
  [("ing_feta",150,"g"),("ing_pomodorini",150,"g"),("ing_origano",1,"pizzico"),
   ("ing_olio_evo",1,"cucchiaio")],25,1,[],
  ["Metti la feta intera in pirofila coi pomodorini attorno.",
   "Olio, origano e forno a 200° per 20 minuti."],["forno","vegetariano"])
p("pia_tofu_curry","Tofu in padella al curry","secondo",
  [("ing_tofu",1,"panetto"),("ing_curry",1,"cucchiaino"),("ing_cipolla",0.5,"pz"),
   ("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Taglia il tofu a cubi e asciugalo bene.",
   "Rosola la cipolla col curry, aggiungi il tofu e dora su tutti i lati."],["vegetariano","veloce"])
p("pia_bresaola_rucola","Bresaola con rucola e grana","secondo",
  [("ing_bresaola",80,"g"),("ing_rucola",40,"g"),("ing_parmigiano",20,"g"),
   ("ing_limone",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],8,1,[],
  ["Disponi la bresaola sul piatto.",
   "Completa con rucola, scaglie di grana, olio e limone."],["senza cottura","veloce"])

# ================================ CONTORNI (15) ================================
p("pia_insalata_mista","Insalata mista","contorno",
  [("ing_insalata",100,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_aceto",1,"cucchiaio")],5,1,[],
  ["Condisci l'insalata con olio, aceto e sale appena prima di servire."],["senza cottura","veloce"])
p("pia_zucchine_padella","Zucchine in padella","contorno",
  [("ing_zucchine",200,"g"),("ing_aglio",1,"pz"),("ing_olio_evo",1,"cucchiaio"),
   ("ing_prezzemolo",1,"mazzetto")],15,1,[],
  ["Rosola l'aglio nell'olio, aggiungi le zucchine a rondelle.",
   "Cuoci 10 minuti a fuoco vivo con sale e prezzemolo."],["padella"])
p("pia_broccoli_limone","Broccoli con olio e limone","contorno",
  [("ing_broccoli",200,"g"),("ing_limone",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],20,1,[10,11,12,1,2,3],
  ["Lessa le cime 8 minuti in acqua salata.",
   "Condisci ancora tiepide con olio, limone e sale."],["inverno","leggero"])
p("pia_fagiolini_olio","Fagiolini all'olio","contorno",
  [("ing_fagiolini",200,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_limone",0.5,"pz")],20,1,[6,7,8,9],
  ["Lessa i fagiolini 12 minuti, devono restare croccanti.",
   "Condisci con olio, sale e qualche goccia di limone."],["estate","leggero"])
p("pia_carote_vapore","Carote al vapore","contorno",
  [("ing_carote",200,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_prezzemolo",1,"mazzetto")],15,1,[],
  ["Cuoci le carote a rondelle al vapore per 10 minuti.",
   "Condisci con olio, sale e prezzemolo."],["leggero"])
p("pia_spinaci_padella","Spinaci saltati in padella","contorno",
  [("ing_spinaci",250,"g"),("ing_aglio",1,"pz"),("ing_olio_evo",1,"cucchiaio")],12,1,[],
  ["Scalda olio e aglio, butta gli spinaci e coprili.",
   "Appena appassiti alza la fiamma per far evaporare l'acqua, poi sala."],["padella","veloce"])
p("pia_melanzane_forno","Melanzane al forno","contorno",
  [("ing_melanzane",250,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_origano",1,"pizzico")],30,1,[6,7,8,9],
  ["Taglia le melanzane a fette e disponile in teglia.",
   "Olio, sale, origano e forno a 200° per 25 minuti."],["forno","estate"])
p("pia_peperoni_padella","Peperoni in padella","contorno",
  [("ing_peperoni",200,"g"),("ing_cipolla",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],25,1,[6,7,8,9],
  ["Stufa i peperoni a listarelle con la cipolla e l'olio.",
   "Coperti, 20 minuti, finché sono morbidi."],["padella","estate"])
p("pia_finocchi_gratinati","Finocchi gratinati","contorno",
  [("ing_finocchi",1,"finocchio"),("ing_parmigiano",2,"cucchiaio"),("ing_burro",1,"noce")],35,2,[11,12,1,2,3,4],
  ["Lessa i finocchi a spicchi per 10 minuti e scolali bene.",
   "In pirofila con burro e parmigiano, forno a 200° per 20 minuti."],["forno","inverno"])
p("pia_radicchio_piastra","Radicchio alla piastra","contorno",
  [("ing_radicchio",150,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_balsamico",1,"cucchiaio")],12,1,[9,10,11,12,1,2],
  ["Taglia i cespi in quarti e scottali in padella rovente con poco olio.",
   "Sale e un giro di balsamico a fine cottura."],["autunno","veloce"])
p("pia_cavolfiore_forno","Cavolfiore al forno","contorno",
  [("ing_cavolfiore",250,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_paprika",1,"cucchiaino")],35,1,[10,11,12,1,2,3],
  ["Dividi il cavolfiore in cimette e condiscile con olio, sale e paprika.",
   "Forno a 200° per 30 minuti, girando una volta."],["forno","inverno"])
p("pia_pomodori_cipolla","Insalata di pomodori e cipolla","contorno",
  [("ing_pomodori",200,"g"),("ing_cipolla_rossa",0.5,"pz"),("ing_origano",1,"pizzico"),
   ("ing_olio_evo",1,"cucchiaio")],8,1,[5,6,7,8,9],
  ["Taglia i pomodori a spicchi e la cipolla fine.",
   "Condisci con olio, sale e origano; lascia insaporire 5 minuti."],["senza cottura","estate"])
p("pia_verza_stufata","Verza stufata","contorno",
  [("ing_verza",250,"g"),("ing_cipolla",0.5,"pz"),("ing_olio_evo",1,"cucchiaio")],30,1,[10,11,12,1,2],
  ["Affetta la verza e stufala con cipolla, olio e mezzo bicchiere d'acqua.",
   "Coperta, 25 minuti, mescolando di tanto in tanto."],["inverno"])
p("pia_funghi_trifolati","Funghi trifolati","contorno",
  [("ing_funghi",200,"g"),("ing_aglio",1,"pz"),("ing_prezzemolo",1,"mazzetto"),
   ("ing_olio_evo",1,"cucchiaio")],15,1,[],
  ["Rosola l'aglio, aggiungi i funghi a fette a fuoco vivo.",
   "Quando hanno perso l'acqua, sala e finisci col prezzemolo."],["padella","veloce"])
p("pia_zucca_forno","Zucca al forno","contorno",
  [("ing_zucca",250,"g"),("ing_olio_evo",1,"cucchiaio"),("ing_rosmarino",1,"rametto")],30,1,[9,10,11,12],
  ["Taglia la zucca a fette spesse un dito.",
   "Olio, sale, rosmarino e forno a 200° per 25 minuti."],["forno","autunno"])

# ============================== costruzione + validazione ==============================
ING = {x["id"]: x for x in json.load(open("pranzo/data/seed-ingredienti.json", encoding="utf-8"))}
SOGLIE = {"proteina": {"g":80,"ml":80,"pz":1}, "carboidrato": {"g":30,"ml":30,"pz":1}, "fibra": {"g":30,"ml":30,"pz":1}}

def in_canonica(ing, qta, unita):
    if unita == ing["unita"]: return qta
    for c in ing["conversioni"]:
        if c["label"] == unita: return qta * c["fattore"]
    raise SystemExit(f"unita '{unita}' non valida per {ing['id']} (canonica {ing['unita']}, conversioni {[c['label'] for c in ing['conversioni']]})")

def macro_coperti(ingredienti):
    out = set()
    for (iid, qta, unita) in ingredienti:
        ing = ING[iid]
        m = ing["macro"]
        if m not in SOGLIE: continue
        if in_canonica(ing, qta, unita) >= SOGLIE[m][ing["unita"]]: out.add(m)
    return out

piatti, errori = [], []
for (pid, nome, tipo, ingr, tempo, diff, stag, passi, tags) in P:
    mc = macro_coperti(ingr)
    if tipo == "unico" and mc != {"proteina","carboidrato","fibra"}:
        errori.append(f"{pid}: unico ma copre {sorted(mc)}")
    if tipo == "primo" and "carboidrato" not in mc: errori.append(f"{pid}: primo senza carboidrato")
    if tipo == "secondo" and "proteina" not in mc: errori.append(f"{pid}: secondo senza proteina")
    if tipo == "contorno" and "fibra" not in mc: errori.append(f"{pid}: contorno senza fibra")
    if not (1 <= diff <= 3): errori.append(f"{pid}: difficolta {diff}")
    if not (5 <= tempo <= 90): errori.append(f"{pid}: tempo {tempo}")
    if not passi: errori.append(f"{pid}: senza passi")
    piatti.append({"id":pid,"nome":nome,"tipo":tipo,
        "ingredienti":[{"ingredienteId":i,"qta":q,"unita":u} for (i,q,u) in ingr],
        "tempoMin":tempo,"difficolta":diff,"stagioni":stag,"passi":passi,
        "origine":"base","tags":tags,"attivo":True})

ids = [x["id"] for x in piatti]
dup = [k for k,v in collections.Counter(ids).items() if v>1]
if dup: errori.append(f"id duplicati: {dup}")
nomi = [x["nome"].lower() for x in piatti]
dupn = [k for k,v in collections.Counter(nomi).items() if v>1]
if dupn: errori.append(f"nomi duplicati: {dupn}")

if errori:
    print("ERRORI:"); [print("  -", e) for e in errori]; raise SystemExit(1)

json.dump(piatti, open("pranzo/data/seed-piatti.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)

conta = collections.Counter(x["tipo"] for x in piatti)
print("piatti:", len(piatti), dict(conta))

# disponibilita' per mese: un piatto e' escluso se un ingrediente e' fuori stagione
def disponibili(mese):
    n = 0
    for x in piatti:
        ok = True
        for v in x["ingredienti"]:
            st = ING[v["ingredienteId"]]["stagioni"]
            if st and mese not in st: ok = False; break
        if ok: n += 1
    return n
print("piatti disponibili per mese:", {m: disponibili(m) for m in range(1,13)})
print("unici disponibili per mese:", {m: sum(1 for x in piatti if x["tipo"]=="unico" and all(
      (not ING[v['ingredienteId']]['stagioni']) or m in ING[v['ingredienteId']]['stagioni'] for v in x["ingredienti"]))
      for m in range(1,13)})
print("famiglie proteine usate:", sorted({ING[v['ingredienteId']].get('famiglia') for x in piatti for v in x['ingredienti']
      if ING[v['ingredienteId']]['macro']=='proteina'} - {None}))
