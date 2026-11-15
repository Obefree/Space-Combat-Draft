import { SpaceCombatGame } from "./DiceDraftGame";

export default function Home() {
  return (
    <>
      <nav className="battleModeSwitcher" aria-label="Режимы космического боя">
        <span className="battleModeSwitchActive" aria-current="page">Классический бой</span>
        <a className="battleModeSwitchLink" href="/fleet-test">Демо-бой · новый баланс</a>
      </nav>
      <SpaceCombatGame />
    </>
  );
}
