# Leśniczówka — symulator leśnictwa

Przeglądarkowa gra pixel-art o prowadzeniu małego polskiego leśnictwa. Widok z góry, wszystko rysowane kodem (bez plików graficznych).
**Wersja 0.2.0 — prototyp.** Silnik i sposób rysowania pochodzą z „Polskiej wsi” 0.6.2.

## Uruchamianie

### GitHub Pages
1. Wrzuć **zawartość tego folderu** (nie sam ZIP) do głównego katalogu repozytorium.
2. `Settings → Pages → Deploy from a branch`, gałąź `main`, folder `/ (root)`.
3. Otwórz adres Pages.

### Lokalnie
```bash
python -m http.server 8000
```
Potem `http://localhost:8000/`. Nie otwieraj `index.html` dwuklikiem (`file://`) — moduły JS się nie załadują.

## Na czym polega gra
- **Gospodarka leśna:** wyznaczasz drzewa do wycinki (od 25 lat), wysyłasz ekipę. Pilarz ścina drzewo (upada w stronę lasu), tnie je na kłody, zostaje pniak i gałęzie.
- **Transport drewna:** ciągnik zrywkowy sam przyjeżdża, wyciągarką ściąga kłody na przyczepę i wozi je na składnicę. Ciężarówka odbiera drewno ze składnicy i płaci (sama przyjeżdża przy 16 m³ albo na żądanie — K).
- **Odnowienie:** sadzisz sadzonki (narzędzie 3 albo przycisk na karcie pniaka). Rosną widocznie z porami roku. Pniaki bez odnowienia obniżają stan lasu.
- **Interwencje:** quady i crossy na drogach leśnych, śmieci po grzybiarzach, dym latem. Wysyłasz patrol — leśniczy wsiada do terenówki i jedzie sam.
- **Trzy wskaźniki:** budżet, stan lasu (pokrycie koronami, odnowienie, śmieci, szkody), ochrona terenu (zgłoszenia obsłużone i zostawione).
- **Plan na sezon** z nadleśnictwa: drewno na składnicę, sadzonki, zgłoszenia → premia.

## Życie w lesie
Sarny, jelenie (byk z łaniami), dziki z warchlakami, lisy, wataha wilków (płoszy sarny i jelenie), zające, ptaki.
Grzybiarze (koniec lata i jesień) przyjeżdżają autem i chodzą z koszykami, spacerowicze z psami, rowerzyści, myśliwy wieczorem na ambonie, ruch na szosie.
Leśniczy chodzi po podwórzu z jamnikiem. Zwierzęta uciekają przed ludźmi i pojazdami; auta hamują przed zwierzyną.
Pory roku zmieniają las (jesienne kolory, bezlistne drzewa i śnieg zimą), jest dzień i noc z reflektorami.

## Sterowanie
| Klawisz | Działanie |
|---|---|
| Mysz | przeciągnij mapę, kliknij obiekt |
| Kółko / Z / + − | przybliżenie (całkowite skale, ostre piksele) |
| 1 / 2 / 3 | podgląd / wycinka / sadzenie |
| Shift + przeciągnij | wyznacz obszar do wycinki |
| E | wyślij ekipę |
| K | zamów wywóz drewna |
| Q | patrol do najstarszego zgłoszenia |
| F | kamera śledzi wybrany obiekt |
| WASD / strzałki | przesuwanie widoku |
| T / P / M | tempo ×1 ×3 ×10 / pauza / dźwięk |
| G | las rośnie o 10 lat (test) |
| F3 | debug |

Gra zapisuje się sama co 30 s (localStorage).

## Pliki
| Plik | Odpowiedzialność | Skąd |
|---|---|---|
| `src/core.js` | stan, kalendarz, jednostki, rysowanie prostokątów | wzorzec z farmy |
| `src/geometry.js` | kolizje OBB / koła | **1:1 z farmy** |
| `src/nav.js` | siatka A* | **1:1 z farmy** |
| `src/sprite.js` | obracanie sprite'ów z obrysem, cienie, mikro-czcionka | wydzielone z `vehicles.js` i `world.js` farmy |
| `src/map.js` | mapa jako dane: drogi, oddziały, leśniczówka, składnica, polana, uprawa, kolizje | wzorzec z farmy |
| `src/roads.js` | graf dróg, Dijkstra, trasa do dowolnego punktu | nowe |
| `src/forest.js` | drzewa jako dane, gatunki, wzrost, wycinka, malowanie w kawałkach 256 px | nowe |
| `src/paint.js` | podłoże: ściółka, pobocza, drogi, budynki | wzorzec `world.js` |
| `src/ents.js` | rejestr obiektów, siatki nawigacji, zagrożenia dla zwierząt | nowe (z `obstacles.js`) |
| `src/life/agents.js` | pojazdy, piesi ze scenariuszem, zwierzyna | z `life.js` + `tow.js` farmy |
| `src/life/sprites.js` | wygląd pojazdów, ludzi, zwierząt | część z `life.js` farmy |
| `src/life/populate.js` | zwierzęta w grupach, goście w lesie | nowe |
| `src/jobs.js` | ekipa, zrywka, składnica, wywóz | nowe |
| `src/incidents.js` | zgłoszenia, patrol, leśniczy | nowe |
| `src/economy.js` | wskaźniki, plan na sezon | nowe |
| `src/render.js` | kolejność warstw, noc, znaczniki | wzorzec z farmy |
| `src/ui.js`, `src/input.js` | HUD, mysz i klawiatura | nowe |
| `src/sound.js` | WebAudio (wiatr, ptaki, dzięcioł, piła, silniki) | wzorzec z farmy |
| `src/save.js` | zapis gry | wzorzec z farmy |

## Czas w grze (0.2)
- **Czas dnia:** 1 minuta gry = 1 sekunda przy ×1 (dzień 6:00–21:30 to ok. 15 minut). Noc przewija się sama ×8 — chyba że trwa interwencja, pali się las albo kręci się kłusownik. Klawisz **N** wyłącza przewijanie nocy.
- **Tydzień:** pon.–sob. pracują ekipa (7–15), ciągnik (7–17) i transport (8–15). Zlecenie poza godzinami czeka („ekipa przyjedzie jutro o 7:00”). W weekend więcej spacerowiczów, rowerzystów i quadów.
- **Czas lasu:** pora roku trwa 3 dni. Przy jej zmianie pojawia się **raport z sezonu** (drewno, sadzenie, zgłoszenia, finanse, plan, ocena nadleśniczego), a las rośnie skokowo o 3 lata.

## Rozkład dnia
| Kto | Kiedy |
|---|---|
| Grzybiarze | koniec lata i jesień, od świtu do południa (wracają do 15:00) |
| Spacerowicze, rowerzyści | 9–18 / 9–19, w weekend częściej |
| Ruch na szosie | szczyt rano i po południu, w nocy prawie pusto |
| Myśliwy | wieczorem na ambonie do ok. 22:30, czasem strzał płoszy zwierzynę |
| Sarny, jelenie, lisy, zające | w dzień leżą w ostojach, o zmierzchu i nocą żerują (część saren także w dzień) |
| Dziki, wilki | nocą |
| Leśniczy | w dzień na podwórzu, nocą śpi — wstaje na pilne zgłoszenie |
| Quad / cross | głównie weekendowe popołudnia |
| Dym | suche letnie dni |
| Kłusownik | nocą: samochód bez świateł, zakłada wnyki; niezłapany zostawia wnyki, które ktoś później znajdzie |

## Zmiany w 0.2 „Rytm lasu”
- Nowy model czasu (patrz wyżej), raport z sezonu, dni tygodnia.
- Prędkości pojazdów 2× większe; terenówka na sygnale jedzie po drodze leśnej prawie pełną prędkością.
- Dużo mniej ruchu: goście jako wydarzenia, nie korek.
- Zwierzyna z rytmem dobowym (ostoje w dzień, żerowanie o zmierzchu).
- Nowe zgłoszenie: kłusownik i wnyki. Leśniczy śpi w nocy.

## Dalej (pomysły)
Fotopułapki i dodatkowy pracownik, wichury i szkody (wiatrołomy), szkodniki, grodzenie nowych upraw, zwierzyna zgryzająca sadzonki poza grodzeniem, więcej oddziałów i większa mapa, ambony do postawienia, edukacja leśna (ścieżka przyrodnicza).
