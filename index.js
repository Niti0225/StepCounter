import 'react-native-gesture-handler'; // muss erste Zeile sein
import 'react-native-reanimated';       // Reanimated Runtime laden

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
