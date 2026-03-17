"use client";
import React, { createContext, useContext } from 'react';

const UserContext = createContext({
  user: null,
  loading: true,
});

export const UserProvider = ({ children, value }) => {
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  return useContext(UserContext);
};
