import { router } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { auth, db } from '../constants/Firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [logoAnim] = useState(new Animated.Value(1));

  const handleAuth = async () => {
    try {
      setIsLoading(true);

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Validate sign-up fields
        if (!firstName.trim() || !lastName.trim()) {
          Alert.alert('Error', 'Please fill in all fields');
          setIsLoading(false);
          return;
        }

        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update user profile with name
        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`
        });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: `${firstName} ${lastName}`,
          createdAt: new Date()
        });
      }
      
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]).start();
    setIsLogin(!isLogin);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContainer}>
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: logoAnim }] }}>
              <Image source={require('../assets/images/smashbook-logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Collect the past. Color the present.</Text>
            </Animated.View>
            <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>

            {!isLogin && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  placeholderTextColor="#A0A0A0"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  placeholderTextColor="#A0A0A0"
                />
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#A0A0A0"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#A0A0A0"
            />
            
            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleAuth}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleToggle} activeOpacity={0.7}>
              <Text style={styles.switchText}>
                {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfcf8', // matches logo background
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#FF914D', // orange from logo
    fontWeight: '600',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
    color: '#1A3140', // navy from logo
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 0,
    backgroundColor: '#fff',
    padding: 14,
    fontSize: 17,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  button: {
    backgroundColor: '#FF914D', // orange from logo
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: '#FF914D',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  switchText: {
    color: '#1A3140', // navy from logo
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
}); 