// App.tsx
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Pedometer } from 'expo-sensors';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';

// Deine Components
import CircularStats from './src/components/CircularStats';
import HistoryList from './src/components/HistoryList';
import StepCharts from './src/components/StepCharts';
import SettingsScreen from './src/components/SettingsScreen';
import ProfileScreen from './src/components/ProfileScreen';
import UpgradeScreen from './src/components/UpgradeScreen';
import LegalScreen from './src/components/LegalScreen';
import TermsofService from './src/components/TermsofService';
import OnboardingScreen from './src/components/OnboardingScreen';
import InsightsScreen from './src/components/InsightsScreen';
import ShareScreen from './src/components/ShareScreen';
import ConsentScreen from './src/components/ConsentScreen';

// Aus /screens
import AchievementsScreen from './src/screens/Achievements';
import ExportScreen from './src/screens/ExportScreen';
import LeaderboardScreen from './src/components/LeaderboardScreen';

// Storage Helpers
import { loadStepHistory, saveStepHistory } from './src/untils/storage';

const DAILY_GOAL = 10_000 as const;

/* ------------------ Helpers ------------------ */
function getLocalDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prettyToday(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isGranted(resp: unknown): boolean {
  const p = resp as { granted?: boolean; status?: string } | null | undefined;
  if (p?.granted === true) return true;
  if (p?.status === 'granted') return true;
  return false;
}

function makeDailyCalendarTrigger(hour: number): Notifications.CalendarTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    hour,
    minute: 0,
    repeats: true,
  };
}

/* ------------------ Navigation Types ------------------ */
export type RootStackParamList = {
  Onboarding: undefined;
  Consent: undefined;
  Home: undefined;
  History: undefined;
  Settings: undefined;
  Profile: undefined;
  Upgrade: undefined;
  Legal: undefined;
  TermsofService: undefined;
  Insights: undefined;
  Share: undefined;
  Achievements: undefined;
  Export: undefined;
  Leaderboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

/* ------------------ Notifications ------------------ */
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

void SplashScreen.preventAutoHideAsync();

/* ------------------ HomeScreen (inline) ------------------ */
function HomeScreenInline({ navigation }: { navigation: any }) {
  const [steps, setSteps] = useState<number>(0);
  const [history, setHistory] = useState<Record<string, number>>({});
  const dayKeyRef = useRef<string>(getLocalDateKey());
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (Platform.OS !== 'web') {
          const notifPerm = await Notifications.requestPermissionsAsync();
          if (!isGranted(notifPerm)) {
            console.log('Benachrichtigungen nicht erteilt');
          }
        }

        if (Platform.OS === 'ios') {
          const pedPerm = await Pedometer.requestPermissionsAsync();
          if (!isGranted(pedPerm)) {
            Alert.alert('Bewegung', 'Schrittzählung wurde nicht erlaubt.');
          }
        }

        const todayKey = getLocalDateKey();
        dayKeyRef.current = todayKey;

        const stored = (await loadStepHistory()) || {};
        const savedSteps = stored[todayKey] ?? 0;
        setHistory(stored);
        setSteps(savedSteps);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(startOfDay, new Date());
        const accurate = Math.max(result?.steps ?? 0, savedSteps);
        setSteps(accurate);

        const updated = { ...stored, [todayKey]: accurate };
        setHistory(updated);
        await saveStepHistory(updated);

        if (Platform.OS !== 'web') {
          await scheduleDailyNotifications();
        }

        const sub = Pedometer.watchStepCount(({ steps: countSinceSub }) => {
          const nowKey = getLocalDateKey();

          // Tageswechsel
          if (dayKeyRef.current !== nowKey) {
            dayKeyRef.current = nowKey;
            lastCountRef.current = countSinceSub;
            setSteps(0);
            setHistory((prev) => {
              const up = { ...prev, [nowKey]: 0 };
              void saveStepHistory(up);
              return up;
            });
            return;
          }

          if (lastCountRef.current === null) {
            lastCountRef.current = countSinceSub;
            return;
          }

          const delta = countSinceSub - lastCountRef.current;
          if (delta <= 0) return;
          lastCountRef.current = countSinceSub;

          setSteps((prev) => {
            const next = prev + delta;
            setHistory((prevH) => {
              const up = { ...prevH, [nowKey]: next };
              void saveStepHistory(up);
              return up;
            });
            return next;
          });
        });

        return () => sub?.remove?.();
      } catch (e) {
        console.warn('Init/Home error:', e);
      }
    };

    void init();
  }, []);

  async function scheduleDailyNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const hour of [12, 17]) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🏃‍♂️ Zeit für Schritte!',
            body: 'Bleib aktiv – dein Ziel wartet!',
          },
          trigger: makeDailyCalendarTrigger(hour),
        });
      }
    } catch (e) {
      console.log('Notification schedule error:', e);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.containerCentered}>
        <Text style={styles.title}>Stay Active</Text>
        <Text style={styles.dateText}>Heute – {prettyToday()}</Text>
        <CircularStats steps={steps} goal={DAILY_GOAL} />
        <Text style={styles.goalText}>Ziel: {DAILY_GOAL.toLocaleString()} Schritte</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.neonButton} onPress={() => navigation.navigate('History')}>
            <Text style={styles.neonButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.neonButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.neonButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="light" />
      </View>
    </SafeAreaView>
  );
}

/* ------------------ HistoryScreen (inline) ------------------ */
function HistoryScreenInline() {
  const [history, setHistory] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const h = (await loadStepHistory()) || {};
      setHistory(h);
    })();
  }, []);

  const isEmpty = !history || Object.keys(history).length === 0;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Step History</Text>
          {isEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ color: '#cfe6ff', fontWeight: '800', fontSize: 18, marginBottom: 6 }}>
                Noch keine Daten
              </Text>
              <Text style={{ color: '#9ab0d3', textAlign: 'center' }}>
                Geh ein paar Schritte, dann taucht hier deine Historie auf. 💪
              </Text>
            </View>
          ) : (
            <>
              <HistoryList history={history} />
              <StepCharts history={history} />
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ------------------ App Root ------------------ */
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0B0C2A',
  },
};

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise((r) => setTimeout(r, 300));
        const seen = await AsyncStorage.getItem('hasSeenOnboarding');
        setFirstLaunch(seen === null);
      } catch {
        setFirstLaunch(false);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    };
    void prepare();
  }, []);

  if (!appReady || firstLaunch === null) return null;

  return (
    <NavigationContainer theme={navTheme}>
      {/* globaler Header AUS -> keine doppelten Back-Buttons mit deinen Custom-Headern */}
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          // "animationEnabled" entfernt -> verursacht TS-Fehler in deinem Stack-Typ
          // "presentation" ebenfalls weggelassen, um inkompatible Typen zu vermeiden
        }}
      >
        {/* Optional am Anfang */}
        {firstLaunch && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
        <Stack.Screen name="Consent" component={ConsentScreen} />

        {/* Kern-Screens */}
        <Stack.Screen name="Home" component={HomeScreenInline} />
        <Stack.Screen name="History" component={HistoryScreenInline} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        <Stack.Screen name="TermsofService" component={TermsofService} />

        {/* Zusätzliche Ziele aus Settings */}
        <Stack.Screen name="Insights" component={InsightsScreen} />
        <Stack.Screen name="Share" component={ShareScreen} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />
        <Stack.Screen name="Export" component={ExportScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ------------------ Styles ------------------ */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0C2A' },
  container: { flex: 1, padding: 20 },
  containerCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scroll: { flex: 1 },
  title: {
    fontSize: 36,
    color: '#00F0FF',
    marginBottom: 10,
    fontWeight: 'bold',
    textShadowColor: '#00FFFF',
    textShadowRadius: 10,
    textAlign: 'center',
  },
  dateText: { fontSize: 20, color: '#AAAAFF', marginBottom: 20, textAlign: 'center' },
  goalText: { fontSize: 24, color: '#FF00D4', marginTop: 20, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', marginTop: 50, gap: 16 },
  neonButton: {
    borderColor: '#00F0FF',
    borderWidth: 2,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 26,
    backgroundColor: '#0B0C2A',
    shadowColor: '#00F0FF',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
    marginHorizontal: 6,
  },
  neonButtonText: { color: '#00F0FF', fontSize: 18, fontWeight: '700' },
});
