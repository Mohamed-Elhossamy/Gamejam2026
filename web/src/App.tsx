import LambdaShell from './components/LambdaShell';
import { useLambdaGame } from './game/useLambdaGame';

export default function App() {
  const { view, actions } = useLambdaGame();
  return <LambdaShell view={view} actions={actions} />;
}
