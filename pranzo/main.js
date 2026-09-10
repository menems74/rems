/* Pranzo 2.0 · logica della home.
   Per ora: installazione, stato rete e nulla piu'. Il resto arriva con le
   specifiche, appoggiandosi al nucleo in core.js. */
(function(){
'use strict';
var P = window.PRANZO;

P.pwa({installId:'install', stateId:'stateText', stateWrapId:'state', helpId:'installHelp', sw:'sw.js'});
})();
