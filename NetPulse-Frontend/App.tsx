import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Button } from 'react-native';
import axios from 'axios';

// Define interface for device
interface Device {
  id: number;
  name: string;
  ip: string;
  status: string;
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);

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
            <Text>{item.name} ({item.ip}) - {item.status}</Text>
          </View>
        )}
      />
    </View>
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
  },
});