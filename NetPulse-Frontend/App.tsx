import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, Button, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define interface for device
interface Device {
  id: number;
  name: string;
  ip: string;
  status: string;
}

// Home Screen (Devices List)
function HomeScreen({ navigation }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleIp, setScheduleIp] = useState('');
  const [cronTime, setCronTime] = useState('0 20 * * *');
  const [action, setAction] = useState('pause');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Request permissions
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Notification permissions not granted');
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
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://192.168.1.14:3000/devices');
      setDevices(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    try {
      setLoading(true);
      await axios.get('http://192.168.1.14:3000/scan');
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: 'Network scan completed',
        },
        trigger: null,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to scan network');
    } finally {
      setLoading(false);
    }
  };

  const pauseDevice = async (ip: string) => {
    try {
      await axios.post('http://192.168.1.14:3000/pause', { ip });
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: `Internet paused for ${ip}`,
        },
        trigger: null,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to pause device');
    }
  };

  const unpauseDevice = async (ip: string) => {
    try {
      await axios.post('http://192.168.1.14:3000/unpause', { ip });
      await fetchDevices();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'NetPulse',
          body: `Internet unpaused for ${ip}`,
        },
        trigger: null,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to unpause device');
    }
  };

  const scheduleAction = async () => {
    try {
      await axios.post('http://192.168.1.14:3000/schedule', {
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
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule action');
    }
  };

  // Check device status periodically
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(async () => {
      for (const device of devices) {
        try {
          const response = await axios.get(`http://192.168.1.14:3000/status/${device.ip}`);
          if (response.data.status !== device.status && response.data.status !== 'paused') {
            await supabase.from('devices').update({ status: response.data.status }).eq('ip', device.ip);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'NetPulse',
                body: `Device ${device.ip} is now ${response.data.status}`,
              },
              trigger: null,
            });
            fetchDevices();
          }
        } catch (error) {
          console.error('Error checking status:', error);
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [devices]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NetPulse Devices</Text>
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      <Button title={loading ? 'Scanning...' : 'Scan Network'} onPress={scanNetwork} disabled={loading} />
      <FlatList
        data={devices}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.device}>
            <Text onPress={() => navigation.navigate('Details', { ip: item.ip })}>
              {item.name} ({item.ip}) - {item.status}
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                title="Pause"
                onPress={() => pauseDevice(item.ip)}
                disabled={item.status === 'paused'}
              />
              <Button
                title="Unpause"
                onPress={() => unpauseDevice(item.ip)}
                disabled={item.status === 'active'}
              />
            </View>
          </View>
        )}
      />
      <View style={styles.scheduleContainer}>
        <Text>Schedule Action</Text>
        <TextInput
          style={styles.input}
          placeholder="Device IP"
          value={scheduleIp}
          onChangeText={setScheduleIp}
        />
        <TextInput
          style={styles.input}
          placeholder="Cron Time (e.g., 0 20 * * *)"
          value={cronTime}
          onChangeText={setCronTime}
        />
        <TextInput
          style={styles.input}
          placeholder="Action (pause/unpause)"
          value={action}
          onChangeText={setAction}
        />
        <Button title="Schedule" onPress={scheduleAction} />
      </View>
    </View>
  );
}

// Device Details Screen
function DetailsScreen({ route }) {
  const { ip } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://192.168.1.14:3000/device/${ip}`);
        setDetails(response.data);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch device details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [ip]);

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />;
  if (!details) return <Text>No details available</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Details</Text>
      <Text>IP: {details.ip}</Text>
      <Text>Hostname: {details.hostname}</Text>
      <Text>MAC: {details.mac}</Text>
      <Text>Vendor: {details.vendor}</Text>
      <Text>OS: {details.os}</Text>
    </View>
  );
}

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'NetPulse' }} />
        <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Device Details' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  device: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  scheduleContainer: {
    padding: 10,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 5,
    width: '100%',
  },
});