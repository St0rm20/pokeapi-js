/* Datos estáticos de presentación: colores y nombres en español.
   Los datos de cada Pokémon se obtienen siempre desde PokeAPI. */
(function () {
  'use strict';

  // Color de fondo y color de texto de cada tipo.
  const TYPES = {
    normal:   { es: 'Normal',    bg: '#A8A878', fg: '#2B2B2B' },
    fire:     { es: 'Fuego',     bg: '#F08030', fg: '#2B2B2B' },
    water:    { es: 'Agua',      bg: '#6890F0', fg: '#2B2B2B' },
    electric: { es: 'Eléctrico', bg: '#F8D030', fg: '#2B2B2B' },
    grass:    { es: 'Planta',    bg: '#78C850', fg: '#2B2B2B' },
    ice:      { es: 'Hielo',     bg: '#98D8D8', fg: '#2B2B2B' },
    fighting: { es: 'Lucha',     bg: '#C03028', fg: '#FFFFFF' },
    poison:   { es: 'Veneno',    bg: '#A040A0', fg: '#FFFFFF' },
    ground:   { es: 'Tierra',    bg: '#E0C068', fg: '#2B2B2B' },
    flying:   { es: 'Volador',   bg: '#A890F0', fg: '#2B2B2B' },
    psychic:  { es: 'Psíquico',  bg: '#F85888', fg: '#2B2B2B' },
    bug:      { es: 'Bicho',     bg: '#A8B820', fg: '#2B2B2B' },
    rock:     { es: 'Roca',      bg: '#B8A038', fg: '#2B2B2B' },
    ghost:    { es: 'Fantasma',  bg: '#705898', fg: '#FFFFFF' },
    dragon:   { es: 'Dragón',    bg: '#7038F8', fg: '#FFFFFF' },
    dark:     { es: 'Siniestro', bg: '#705848', fg: '#FFFFFF' },
    steel:    { es: 'Acero',     bg: '#B8B8D0', fg: '#2B2B2B' },
    fairy:    { es: 'Hada',      bg: '#EE99AC', fg: '#2B2B2B' },
    stellar:  { es: 'Astral',    bg: '#40B5A5', fg: '#2B2B2B' },
    unknown:  { es: '???',       bg: '#68A090', fg: '#2B2B2B' },
    shadow:   { es: 'Oscuro',    bg: '#4A3B5C', fg: '#FFFFFF' }
  };

  const STATS = {
    'hp': 'HP',
    'attack': 'Ataque',
    'defense': 'Defensa',
    'special-attack': 'Ataque Esp.',
    'special-defense': 'Defensa Esp.',
    'speed': 'Velocidad'
  };

  window.PokeData = { TYPES, STATS, BOX_SIZE: 30, STAT_MAX: 150 };
})();
