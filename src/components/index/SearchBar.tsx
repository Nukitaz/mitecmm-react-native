import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Search, User, Book, MapPin } from "lucide-react-native";

export type Suggestion = {
  id: string;
  type: "aula" | "prof" | "materia";
  label: string;
  detail: string;
  aulaResaltada: string;
};

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (text: string) => void;
  isFocused: boolean;
  setIsFocused: (focused: boolean) => void;
  sugerencias: Suggestion[];
  onSelectSuggestion: (sug: Suggestion) => void;
  onSubmitEditing: () => void;
  isDarkMode: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  setSearchTerm,
  isFocused,
  setIsFocused,
  sugerencias,
  onSelectSuggestion,
  onSubmitEditing,
  isDarkMode,
}) => {
  const IconoTipo = ({ type }: { type: string }) => {
    switch (type) {
      case "prof":
        return <User size={16} color="#a855f7" />;
      case "materia":
        return <Book size={16} color="#a855f7" />;
      default:
        return <MapPin size={16} color="#a855f7" />;
    }
  };

  return (
    <View style={styles.searchWrapper}>
      <View
        style={[
          styles.searchContainer,
          !isDarkMode && styles.searchContainerLight,
          isFocused &&
            (isDarkMode
              ? styles.searchContainerActive
              : styles.searchContainerActiveLight),
        ]}
      >
        <Search
          size={18}
          color={isFocused ? "#a855f7" : isDarkMode ? "#a1a1aa" : "#64748b"}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, !isDarkMode && styles.searchInputLight]}
          placeholder="Busca un salón, laboratorio u oficina..."
          placeholderTextColor={isDarkMode ? "#71717a" : "#94a3b8"}
          value={searchTerm}
          onChangeText={setSearchTerm}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="search"
        />
      </View>

      {isFocused && sugerencias.length > 0 && (
        <View
          style={[
            styles.dropdownContainer,
            !isDarkMode && styles.dropdownContainerLight,
          ]}
        >
          {sugerencias.map((sug, index) => (
            <TouchableOpacity
              key={sug.id}
              style={[
                styles.dropdownItem,
                index !== sugerencias.length - 1 &&
                  (isDarkMode
                    ? styles.dropdownItemBorder
                    : styles.dropdownItemBorderLight),
              ]}
              activeOpacity={0.7}
              onPress={() => onSelectSuggestion(sug)}
            >
              <View style={styles.dropdownLeft}>
                <IconoTipo type={sug.type} />
                <Text
                  style={[
                    styles.dropdownLabel,
                    !isDarkMode && styles.dropdownLabelLight,
                  ]}
                  numberOfLines={1}
                >
                  {sug.label}
                </Text>
              </View>
              <Text style={styles.dropdownDetail}>{sug.detail}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchWrapper: {
    width: "100%",
    maxWidth: 580,
    marginTop: 20,
    position: "relative",
    zIndex: 9999,
  },
  searchContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121215",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  searchContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  searchContainerActive: {
    borderColor: "#a855f7",
    backgroundColor: "#18181b",
  },
  searchContainerActiveLight: {
    borderColor: "#a855f7",
    backgroundColor: "#ffffff",
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14,
    outlineStyle: "none" as any,
  },
  searchInputLight: { color: "#0f172a" },
  dropdownContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: "#18181c",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
    zIndex: 10000,
  },
  dropdownContainerLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  dropdownItemBorderLight: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  dropdownLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  dropdownLabelLight: {
    color: "#0f172a",
  },
  dropdownDetail: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 10,
    color: "#a855f7",
    letterSpacing: 2,
  },
});