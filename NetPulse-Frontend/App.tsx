import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Button, TextInput } from 'react-native';
import axios from 'axios';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import PushNotification from 'react-native-push-notification';

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

  const fetchDevices = async () => {
    try {
      const response = await axios.get('http://192.168.1.14:3000/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const scanNetwork = async () => {
    setLoading(true);
    try {
      await axios.get('http://192.168.1.14:3000/scan');
      await fetchDevices();
    } catch (error) {
      console.error('Error scanning network:', error);
    } finally {
      setLoading(false);
    }
  };

  const pauseDevice = async (ip: string) => {
    try {
      await axios.post('http://192.168.1.14:3000/pause', { ip });
      await fetchDevices();
      PushNotification.localNotification({
        message: `Internet paused for ${ip}`,
      });
    } catch (error) {
      console.error('Error pausing device:', error);
    }
  };

  const unpauseDevice = async (ip: string) => {
    try {
      await axios.post('http://192.168.1.14:3000/unpause', { ip });
      await fetchDevices();
      PushNotification.localNotification({
        message: `Internet unpaused for ${ip}`,
      });
    } catch (error) {
      console.error('Error unpausing device:', error);
    }
  };

  const scheduleAction = async () => {
    try {
      await axios.post('http://192.168.1.14:3000/schedule', {
        ip: scheduleIp,
        action,
        cron_time: cronTime,
      });
      PushNotification.localNotification({
        message: `Scheduled ${action} for ${scheduleIp} at ${cronTime}`,
      });
    } catch (error) {
      console.error('Error scheduling:', error);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NetPulse Devices</Text>
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

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const response = await axios.get(`http://192.168.1.14:3000/device/${ip}`);
        setDetails(response.data);
      } catch (error) {
        console.error('Error fetching device details:', error);
      }
    };
    fetchDetails();
  }, [ip]);

  if (!details) return <Text>Loading...</Text>;

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
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
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