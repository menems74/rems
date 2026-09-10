#!/usr/bin/env python3
"""Icone di Pranzo 2.0, disegnate qui invece che a mano.

Un piatto visto dall'alto con la forchetta a sinistra: si riconosce anche a
48 px, dove qualunque dettaglio del "quaderno" diventerebbe una macchia.
Colori dell'app: fondo blu biro, piatto carta.
Uso: python3 data/generatori/icone.py
"""
from PIL import Image, ImageDraw
import os

BLU = (34, 69, 143)
CARTA = (246, 246, 243)
QUI = os.path.dirname(os.path.abspath(__file__))
FUORI = os.path.normpath(os.path.join(QUI, '..', '..', 'icons'))

def disegna(lato, margine=0.0, fondo=BLU, tondo=True):
    """margine: quota di bordo vuoto, per l'icona 'maskable'."""
    s = lato * 8                      # si disegna in grande e si riduce: bordi lisci
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if tondo:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=fondo)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=fondo)

    # area utile: dentro il margine di sicurezza
    m = s * margine
    u0, u1 = m, s - m
    lu = u1 - u0

    # il piatto: anello di carta, spostato a destra per far posto alla forchetta
    cx = u0 + lu * 0.60
    cy = u0 + lu * 0.50
    r = lu * 0.30
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CARTA)
    ri = r * 0.62
    d.ellipse([cx - ri, cy - ri, cx + ri, cy + ri], fill=fondo)

    # la forchetta: tre denti e un manico
    fx = u0 + lu * 0.20
    denti_alto = cy - lu * 0.30
    denti_basso = cy - lu * 0.04
    largo = lu * 0.030
    passo = lu * 0.058
    for i in (-1, 0, 1):
        x = fx + i * passo
        d.rounded_rectangle([x - largo / 2, denti_alto, x + largo / 2, denti_basso],
                            radius=largo / 2, fill=CARTA)
    # collo e manico
    d.rounded_rectangle([fx - passo - largo / 2, denti_basso - largo,
                         fx + passo + largo / 2, denti_basso + largo * 1.4],
                        radius=largo, fill=CARTA)
    d.rounded_rectangle([fx - largo * 0.8, denti_basso, fx + largo * 0.8, cy + lu * 0.30],
                        radius=largo * 0.8, fill=CARTA)

    return img.resize((lato, lato), Image.LANCZOS)

def salva(nome, img):
    percorso = os.path.join(FUORI, nome)
    img.save(percorso)
    print(percorso, img.size)

os.makedirs(FUORI, exist_ok=True)
for lato in (192, 512):
    salva(f'icona-{lato}.png', disegna(lato))
# maskable: il sistema può ritagliare un cerchio, quindi tutto sta nell'80% centrale
for lato in (192, 512):
    salva(f'icona-maskable-{lato}.png', disegna(lato, margine=0.12, tondo=False))
# iOS non ritaglia e non arrotonda da sé: angoli quadrati, niente trasparenza
salva('apple-touch-icon.png', disegna(180, margine=0.04, tondo=False))
salva('favicon-32.png', disegna(32))
