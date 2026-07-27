import { redirect } from 'next/navigation';

// Il proxy redirige già in base alla sessione; questo copre il caso in cui la
// rotta venga raggiunta comunque.
export default function Home() {
  redirect('/cassa');
}
