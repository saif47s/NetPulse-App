import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, Button, TextInput, ActivityIndicator, Alert, Platform, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import { Subscription } from 'expo-notifications';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createClient, AuthSession } from '@supabase/supabase-js';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Supabase client
const supabaseUrl = 'https://wjnstfgsrwgctcbwhtnh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbnN0ZmdzcndnY3RjYndodG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTIzNjksImV4cCI6MjA2MTIyODM2OX0.Ti4J_roZnLMhF6PTvSbVU4AM1hQcauSQ3C5iwo1djJg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Default backend URL
const DEFAULT_BACKEND_URL = 'https://netpulse-backend.onrender.com';

// Navigation param list
type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Details: { ip: string };
};

// Define interfaces
interface Device {
  id: number;
  name: string;
  ip: string;
  status: string;
}

interface DeviceDetails {
  ip: string;
  hostname: string;
  mac: string;
  vendor: string;
  os: string;
}

// Login Screen
function LoginScreen({ navigation }: { navigation: StackNavigationProp<RootStackParamList, 'Login'> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigation.replace('Home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NetPulse Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <TouchableOpacity style={[styles.scheduleButton, loading && styles.disabledButton]} onPress={signIn} disabled={loading}>
        <Text style={styles.scheduleButtonText}>Sign In</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator size="large" color="#0288d1" />}
    </SafeAreaView>
  );
}

// Home Screen (Devices List)
function HomeScreen({ navigation }: { navigation: StackNavigationProp<RootStackParamList, 'Home'> }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleIp, setScheduleIp] = useState('');
  const [cronTime, setCronTime] = useState('0 20 * * *');
  const [action, setAction] = useState('pause');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [isCloud, setIsCloud] = useState(true);
  const notificationListener = useRef<Subscription>();
  const responseListener = useRef<Subscription>();

  useEffect(() => {
    // Request permissions
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Notification permissions not granted. Enable in settings.');
      }
    }
    requestPermissions();

    // Handle notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('NOTIFICATION:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('RESPONSE:', response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${backendUrl}/devices`);
      setDevices(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch devices. Check backend URL or network.');
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    try {
      setLoading(true);
      await axios.get(`${backendUrl}/scan`);
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: 'Network scan completed successfully!',
        },
        trigger: null,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan network. Check backend URL or server.');
    } finally {
      setLoading(false);
    }
  };

  const pauseDevice = async (ip: string) => {
    try {
      setLoading(true);
      await axios.post(`${backendUrl}/pause`, { ip });
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: `Internet paused for ${ip}`,
        },
        trigger: null,
      });
    } catch (error: any) {
      Alert.alert(
        'Error',
        isCloud
          ? 'Pause/Unpause not available with cloud backend. Use a local server.'
          : error.message || 'Failed to pause device.'
      );
    } finally {
      setLoading(false);
    }
  };

  const unpauseDevice = async (ip: string) => {
    try {
      setLoading(true);
      await axios.post(`${backendUrl}/unpause`, { ip });
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: `Internet unpaused for ${ip}`,
        },
        trigger: null,
      });
    } catch (error: any) {
      Alert.alert(
        'Error',
        isCloud
          ? 'Pause/Unpause not available with cloud backend. Use a local server.'
          : error.message || 'Failed to unpause device.'
      );
    } finally {
      setLoading(false);
    }
  };

  const scheduleAction = async () => {
    if (!scheduleIp.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      Alert.alert('Error', 'Please enter a valid IP address (e.g., 192.168.1.10).');
      return;
    }
    if (!['pause', 'unpause'].includes(action)) {
      Alert.alert('Error', 'Action must be "pause" or "unpause".');
      return;
    }
    if (!cronTime.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/)) {
      Alert.alert('Error', 'Please enter a valid cron time (e.g., 0 20 * * *).');
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${backendUrl}/schedule`, {
        ip: scheduleIp,
        action,
        cron_time: cronTime,
      });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: `Scheduled ${action} for ${scheduleIp} at ${cronTime}`,
        },
        trigger: null,
      });
      setScheduleIp('');
      setCronTime('0 20 * * *');
      setAction('pause');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to schedule action. Check inputs and backend URL.');
    } finally {
      setLoading(false);
    }
  };

  // Check device status periodically
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(async () => {
      if (devices.length === 0) return;
      try {
        const responses = await Promise.all(
          devices.map((device: Device) => axios.get(`${backendUrl}/status/${device.ip}`))
        );
        for (let i = 0; i < devices.length; i++) {
          const device = devices[i];
          const response = responses[i];
          if (response.data.status !== device.status && response.data.status !== 'paused') {
            await supabase.from('devices').update({ status: response.data.status }).eq('ip', device.ip);
          }
        }
        fetchDevices();
      } catch (error: any) {
        console.error('Error checking status:', error);
      }
    }, 120000); // Check every 2 minutes
    return () => clearInterval(interval);
  }, [devices, backendUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NetPulse</Text>
      <TextInput
        style={styles.input}
        placeholder="Backend URL (e.g., http://192.168.1.14:3000)"
        value={backendUrl}
        onChangeText={(text) => {
          setBackendUrl(text);
          setIsCloud(!text.includes('192.168'));
        }}
      />
      {loading && <ActivityIndicator size="large" color="#0288d1" />}
      <TouchableOpacity style={styles.scanButton} onPress={scanNetwork} disabled={loading}>
        <Icon name="search" size={20} color="#fff" />
        <Text style={styles.scanButtonText}>{loading ? 'Scanning...' : 'Scan Network'}</Text>
      </TouchableOpacity>
      {isCloud && (
        <Text style={styles.cloudWarning}>
          Note: Pause/Unpause is not available with cloud backend. Use a local server for full control.
        </Text>
      )}
      <FlatList
        data={devices}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.device}>
            <TouchableOpacity onPress={() => navigation.navigate('Details', { ip: item.ip })}>
              <Text style={styles.deviceText}>
                <Icon name="devices" size={18} color="#0288d1" /> {item.name} ({item.ip}) - {item.status}
              </Text>
            </TouchableOpacity>
            {!isCloud && (
              <View style={styles.buttonContainer}>
                <Button
                  title="Pause"
                  onPress={() => pauseDevice(item.ip)}
                  disabled={item.status === 'paused' || loading}
                  color="#0288d1"
                />
                <Button
                  title="Unpause"
                  onPress={() => unpauseDevice(item.ip)}
                  disabled={item.status === 'active' || loading}
                  color="#0288d1"
                />
              </View>
            )}
          </View>
        )}
      />
      <View style={styles.scheduleContainer}>
        <Text style={styles.sectionTitle}>Schedule Action</Text>
        <TextInput
          style={styles.input}
          placeholder="Device IP (e.g., 192.168.1.10)"
          value={scheduleIp}
          onChangeText={setScheduleIp}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Cron Time (e.g., 0 20 * * *)"
          value={cronTime}
          onChangeText={setCronTime}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Action (pause/unpause)"
          value={action}
          onChangeText={setAction}
          editable={!loading}
        />
        <TouchableOpacity style={[styles.scheduleButton, loading && styles.disabledButton]} onPress={scheduleAction} disabled={loading}>
          <Icon name="schedule" size={20} color="#fff" />
          <Text style={styles.scheduleButtonText}>Schedule</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Device Details Screen
function DetailsScreen({ route }: { route: RouteProp<RootStackParamList, 'Details'> }) {
  const { ip } = route.params;
  const [details, setDetails] = useState<DeviceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendUrl] = useState(DEFAULT_BACKEND_URL);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${backendUrl}/device/${ip}`);
        setDetails(response.data);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to fetch device details. Check backend URL.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [ip, backendUrl]);

  if (loading) return <ActivityIndicator size="large" color="#0288d1" />;
  if (!details) return <Text style={styles.errorText}>No details available</Text>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Device Details</Text>
      <View style={styles.detailsContainer}>
        <Text style={styles.detailText}><Icon name="info" size="18" color="#0288d1" /> IP: {details.ip}</Text>
        <Text style={styles.detailText}><Icon name="dns" size="18" color="#0288d1" /> Hostname: {details.hostname}</Text>
        <Text style={styles.detailText}><Icon name="fingerprint" size="18" color="#0288d1" /> MAC: {details.mac}</Text>
        <Text style={styles.detailText}><Icon name="business" size="18" color="#0288d1" /> Vendor: {details.vendor}</Text>
        <Text style={styles.detailText}><Icon name="computer" size="18" color="#0288d1" /> OS: {details.os}</Text>
      </View>
    </SafeAreaView>
  );
}

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0288d1' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NetPulse' }} />
            <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Device Details' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0288d1',
    marginBottom: 20,
  },
  device: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  deviceText: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scanButton: {
    flexDirection: 'row',
    backgroundColor: '#0288d1',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  cloudWarning: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    marginVertical: 10,
    width: '90%',
  },
  scheduleContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 10,
    borderRadius: 10,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0288d1',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#b0bec5',
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    width: '90%',
    backgroundColor: '#fff',
  },
  scheduleButton: {
    flexDirection: 'row',
    backgroundColor: '#0288d1',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  scheduleButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#b0bec5',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginVertical: 5,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginTop: 20,
  },
});