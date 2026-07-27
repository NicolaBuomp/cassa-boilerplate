/**
 * Schermo di cortesia per le pagine riservate al Titolare.
 * Non è una misura di sicurezza — quella è la RLS, che a un Cassiere non
 * restituisce comunque nessuna riga.
 */
export function SoloTitolare() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <p className="font-medium">Riservato al titolare</p>
      <p className="text-sm text-testo-debole">Questa sezione non è disponibile per il tuo ruolo.</p>
    </div>
  );
}
