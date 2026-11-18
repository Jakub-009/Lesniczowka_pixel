# Leśniczówka — symulator leśnictwa

Przeglądarkowa gra pixel-art o prowadzeniu małego polskiego leśnictwa. Widok z góry, wszystko rysowane kodem (bez plików graficznych).
**Wersja 1.4.3** („Czytelne okna” + trwały zapis i porządek HUD-u). Po 1.0 gra jest zamrożona, a 1.1 to jedyna zaplanowana zmiana: wskaźniki, okna i panel sterowania. Dalej tylko gra, testy i drobne poprawki; nowe pomysły trafiają na listę „po 1.0”. Silnik i sposób rysowania pochodzą z „Polskiej wsi” 0.6.2.

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
- **Transport drewna:** ciągnik zrywkowy (albo forwarder) sam przyjeżdża, ściąga kłody i układa je w **stosach przy najbliższej drodze**. Ciągnik siodłowy z wózkiem do dłużycy i żurawiem HDS objeżdża stosy i płaci według ceny rynkowej (sam przyjeżdża przy 16 m³ albo na żądanie — K).
- **Odnowienie:** sadzisz sadzonki (narzędzie 3 albo przycisk na karcie pniaka). Rosną widocznie z porami roku. Pniaki bez odnowienia obniżają stan lasu.
- **Interwencje:** quady i crossy, śmieci, dym latem i wypalanie traw wiosną, nocni intruzi (kłusownik, złodziej drewna ze stosu, zimą złodziej choinek), paśniki do uzupełnienia. Wysyłasz patrol — leśniczy (albo podleśniczy) wsiada do terenówki i jedzie sam.
- **Leśniczówka (L):** kancelaria z petentami, kadry, szkółka, garaż z magazynem, sprzęt, koło łowieckie, paśniki.
- **Trzy wskaźniki:** budżet, stan lasu (pokrycie koronami, odnowienie, śmieci, szkody), ochrona terenu (zgłoszenia obsłużone i zostawione).
- **Plan na sezon** z nadleśnictwa: drewno zerwane do dróg, sadzonki, zgłoszenia → premia 2000 zł.

## Życie w lesie
Sarny, jelenie (byk z łaniami), dziki z warchlakami, lisy, wędrowna wataha wilków (przychodzi na kilka dni gry; sarny i jelenie są wtedy płochliwsze), zające, ptaki. Na ekranie widać tylko część zwierzyny — jej liczba idzie za populacją w obwodzie.
Zbieracze jagód (lato) i grzybiarze (jesień) przyjeżdżają autem i chodzą z wiaderkami i koszykami, spacerowicze z psami, rowerzyści, myśliwy wieczorem na ambonie, ruch na szosie.
Leśniczy chodzi po podwórzu z jamnikiem. Zwierzęta uciekają przed ludźmi i pojazdami; auta hamują przed zwierzyną.
Pory roku zmieniają las (jesienne kolory, bezlistne drzewa i śnieg zimą), jest dzień i noc z reflektorami.

## Sterowanie
| Klawisz | Działanie |
|---|---|
| Mysz | przeciągnij mapę, kliknij obiekt |
| Kółko / Z / + − | przybliżenie (całkowite skale, ostre piksele); w 1.1 bez przycisków +/− |
| 1 / 2 / 3 / 4 | podgląd / wycinka / sadzenie / odnowienie |
| Przeciągnij lewym (w narzędziach 2–4) | zaznacz obszar: drzewa do wycinki, rzędy sadzonek, powierzchnię odnowieniową |
| Prawy przycisk | przesuwanie mapy (w podglądzie także lewy) |
| E | wyślij ekipę |
| L | Leśniczówka: kadry, budynki, sprzęt, finanse, koło łowieckie, paśniki (także klik w dom) |
| C | Poczta (także klik w skrzynkę przy bramie) |
| Tab | mapa leśnictwa: warstwy Gatunki, Wiek, Odnowienie, Prace; tabela oddziałów |
| U | schowaj / pokaż interfejs |
| N | przewijanie nocy wł./wył. |
| Q | patrol do najstarszego zgłoszenia |
| F | kamera śledzi wybrany obiekt |
| WASD / strzałki | przesuwanie widoku |
| T / P / M | tempo ×1 ×2 ×3 (Shift+T: ×10) / pauza / dźwięk (też w Menu) |
| Esc | zamyka okno, karty i podświetlenie pniaków |
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
| `src/paint.js` | podłoże: ściółka, pobocza, drogi, plac | wzorzec `world.js` |
| `src/mail.js` | poczta (dziennik zdarzeń), priorytety zgłoszeń, zwalnianie czasu | nowe w 0.8.1 |
| `src/order.js` | dzikie wysypiska, firma wywozowa, Policja (na miejscu), fotopułapki, szlabany (rura na zawiasie), zatoka parkingowa | nowe w 0.8.2, przerobione w 0.8.3 |
| `src/crossing.js` | zwierzyna na szosie, potrącenia, padlina, myśliwy z psem | nowe w 0.8.3 |
| `src/oddcard.js` | statystyki oddziału (karta i tabela mapy), granice oddziałów, kolory gatunków | nowe w 0.8.1 |
| `src/win.js` | wspólna ramka dużych okien (Poczta, Mapa, Stan lasu, Ochrona terenu): jedno okno, pauza, Esc | nowe w 1.1 |
| `src/windows.js` | okna Poczta, Stan lasu, Ochrona terenu | nowe w 1.1 |
| `src/focus.js` | podświetlenie nieodnowionych pniaków i granic oddziału nad koronami | nowe w 1.1 |
| `src/lodge.js` | zabudowa leśniczówki na osobnej warstwie (lato/zima) | nowe w 0.7.2 |
| `src/ents.js` | rejestr obiektów, siatki nawigacji, zagrożenia dla zwierząt | nowe (z `obstacles.js`) |
| `src/life/agents.js` | pojazdy, piesi ze scenariuszem, zwierzyna | z `life.js` + `tow.js` farmy |
| `src/life/sprites.js` | wygląd pojazdów, ludzi, zwierząt | część z `life.js` farmy |
| `src/life/populate.js` | zwierzęta w grupach, goście w lesie | nowe |
| `src/jobs.js` | ekipy A i B, zrywka (szlaki, forwarder), stosy przy drogach, wywóz z HDS | nowe |
| `src/base.js` | Leśniczówka: kancelaria i petenci, szkółka, garaż, kadry | nowe (0.5) |
| `src/life/fauna.js` | populacje, rozród, wilki, plan łowiecki, paśniki, zgryzanie, rykowisko | nowe (0.5) |
| `src/renew.js` | powierzchnie odnowieniowe, pług LPz, sadzenie w rzędach | nowe |
| `src/incidents.js` | zgłoszenia, jednostki patrolu (leśniczy, podleśniczy), intruzi | nowe |
| `src/economy.js` | wskaźniki, plan na sezon | nowe |
| `src/mapview.js` | okno mapy leśnictwa (Tab): komórki 100×100, warstwy, odczyt wartości, tabela oddziałów | nowe (0.6), przebudowane w 1.1 |
| `src/render.js` | kolejność warstw, noc, znaczniki | wzorzec z farmy |
| `src/ui.js`, `src/input.js` | HUD, mysz i klawiatura | nowe |
| `src/guide.js` | samouczek i ustawienia gry (localStorage `lesniczowka-set`) | nowe w 1.0 |
| `src/sound.js` | WebAudio (wiatr, ptaki, dzięcioł, piła, silniki) | wzorzec z farmy |
| `src/save.js` | zapis gry | wzorzec z farmy |

## Czas w grze (0.2)
- **Czas dnia:** 1 minuta gry = 1 sekunda przy ×1 (dzień 6:00–21:30 to ok. 15 minut). Noc przewija się sama ×8 — chyba że trwa interwencja, pali się las albo kręci się kłusownik. Klawisz **N** wyłącza przewijanie nocy.
- **Tydzień:** pon.–pt. pracują ekipa (7–17), ciągnik (7–17) i transport (6–22); w sobotę wszyscy do 13:00, w niedzielę nikt. Zlecenie poza godzinami czeka („ekipa przyjedzie jutro o 7:00”). W weekend więcej spacerowiczów, rowerzystów i quadów.
- **Czas lasu:** pora roku trwa 3 dni. Przy jej zmianie pojawia się **raport z sezonu** (drewno, sadzenie, zgłoszenia, finanse, plan, ocena nadleśniczego), a las rośnie skokowo o 3 lata.

## Rozkład dnia
| Kto | Kiedy |
|---|---|
| Zbieracze jagód | lato, oddz. 101 i 104 |
| Grzybiarze | jesień (i ostatni dzień lata), od świtu do południa (wracają do 15:00) |
| Petenci w kancelarii | pon.–pt. 8–15 |
| Odbiór opału | pon.–sob. 9–16, ciągnik z przyczepą pod stos |
| Spacerowicze, rowerzyści | 9–18 / 9–19, w weekend częściej |
| Ruch na szosie | szczyt rano i po południu, w nocy prawie pusto |
| Myśliwy (koło łowieckie) | wieczorem i o świcie na ambonie (bez wiosny); strzela według planu łowieckiego, zabiera zwierzynę |
| Polowanie zbiorowe | jesień i zima, sobota rano: linia myśliwych przy drodze, naganka, pokot |
| Zrywka (usługa) | przyjeżdża, gdy leżą kłody; nocuje na placu przy leśniczówce; po robocie odjeżdża |
| Rykowisko | jesień, o zmierzchu i świcie |
| Sarny, jelenie, lisy, zające | w dzień leżą w ostojach, o zmierzchu i nocą żerują (część saren także w dzień) |
| Dziki, wilki | nocą |
| Leśniczy | w dzień na podwórzu, nocą śpi — wstaje na pilne zgłoszenie |
| Quad / cross | głównie weekendowe popołudnia |
| Dym | suche letnie dni; wiosną wypalanie traw przy szosie i polanie |
| Kłusownik | nocą (bez zimy): samochód bez świateł, zakłada wnyki |
| Złodziej drewna | nocą przy stosie przy drodze, ładuje przyczepkę |
| Złodziej choinek | zimą o zmierzchu, wycina młode sosny i świerki |

## Zmiany w 0.3 „Zrąb i odnowienie”
- **Jazda pojazdów:** pojazd goni punkt przed sobą na pasie ruchu i skręca jak prawdziwy (ograniczony skręt kół) — koniec przesuwania bokiem i obracania w miejscu; zakręty łukiem, zawracanie pętlą, zjazd na pobocze przy parkowaniu.
- **Zrywka w głąb lasu (naprawa zacięcia):** maszyna zjeżdża z drogi szlakiem zrywkowym (zostają koleiny), ładuje wszystko w zasięgu, jedzie do kolejnych kłód i wraca. Zabezpieczenie: maszyna bez postępu przez 4 godziny gry jest odholowana na składnicę.
- **Forwarder** (panel Sprzęt, 12 000 zł): 12 m³ ładunku, żuraw, szybszy w terenie. Na start ciągnik z wyciągarką (6 m³, lina 150 px).
- **Zaznaczanie obszarem** w wycince, sadzeniu i odnowieniu (bez Shift).
- **Powierzchnia odnowieniowa (narzędzie 4):** pług leśny LPz orze bruzdy co ok. 1,5 m i zgarnia gałęzie → ekipa sadzi w rzędach (do 4 osób). Bez przygotowania gleby nie przyjmuje się ok. 25% sadzonek, z przygotowaniem ok. 5% — wynik w raporcie z sezonu.
- Naprawa: zadania ekipy głęboko w lesie (daleko od drogi) nie blokują już ekipy.

## Zmiany w 0.2 „Rytm lasu”
- Nowy model czasu (patrz wyżej), raport z sezonu, dni tygodnia.
- Prędkości pojazdów 2× większe; terenówka na sygnale jedzie po drodze leśnej prawie pełną prędkością.
- Dużo mniej ruchu: goście jako wydarzenia, nie korek.
- Zwierzyna z rytmem dobowym (ostoje w dzień, żerowanie o zmierzchu).
- Nowe zgłoszenie: kłusownik i wnyki. Leśniczy śpi w nocy.

## Dalej (pomysły)
Fotopułapki i dodatkowy pracownik, wichury i szkody (wiatrołomy), szkodniki, grodzenie nowych upraw, zwierzyna zgryzająca sadzonki poza grodzeniem, więcej oddziałów i większa mapa, ambony do postawienia, edukacja leśna (ścieżka przyrodnicza).

## Zmiany w 0.5 „Rok w lesie” (0.4 + 0.5 razem)
- **Koleiny i bruzdy blakną:** ślady forwardera, ciągnika i pługa leżą na osobnej warstwie, która co dzień blednie o ok. 12% — po kilkunastu dniach znikają. Zapis pamięta ich wiek.
- **Budżet naprawdę ogranicza:** codzienne koszty (utrzymanie 300 zł + pensje i sprzęt), droższa ścinka (110 zł/drzewo) i zrywka (40 zł/m³), zlecenia wymagają pieniędzy w kasie. Cena drewna zmienia się co porę roku (zimą drożej, latem taniej). Debet powyżej 8 000 zł — nadleśnictwo zwalnia dodatkowe osoby.
- **Dwie ekipy:** ekipa B (260 zł/dzień, panel L). Zlecenie dzieli się na skupiska do 10 zadań i trafia do mniej obciążonej ekipy.
- **Stosy przy drogach zamiast składnicy:** zrywka układa drewno na poboczu najbliższej drogi leśnej; ciągnik siodłowy z wózkiem do dłużycy i żurawiem HDS objeżdża stosy. Kliknij stos, żeby zobaczyć ilość i wartość. Dawna składnica to teraz baza maszyn.
- **Pory roku:** grzybiarze tylko jesienią, latem zbieracze jagód, zimą paśniki i złodzieje choinek, jesienią rykowisko, wiosną okres lęgowy w oddz. 103 (wycinka czeka do lata) i wypalanie traw. Zimą ekipa nie sadzi (zadania czekają do wiosny).
- **Zwierzyna:** mniej zwierząt na ekranie, populacje w obwodzie z rozrodem wiosną, wilkami (gatunek chroniony), stratami zimą zależnymi od dokarmiania.
- **Koło łowieckie:** plan odstrzału na rok (od wiosny), myśliwy naprawdę strzela (nigdy do lochy z warchlakami) i zabiera zwierzynę; wniosek o odstrzał redukcyjny przy dużej presji.
- **Zgryzanie i grodzenie:** sarny i jelenie zgryzają niegrodzone sadzonki z nasadzeń (część ginie). Powierzchnię można ogrodzić siatką (karta powierzchni, 7 zł/m).
- **Ciężarówka** wygląda jak ciągnik siodłowy do dłużycy: kabina, żuraw HDS za kabiną, kłonice, długie kłody od ciągnika do wózka.
- **Szersza rozstawa** sadzonek w rzędach (ok. 1,3 m), orka 3 zł/m.
- **Leśniczówka jako baza (L lub klik w dom):** kancelaria (petenci kupują drewno opałowe ze stosów, zezwolenia, sadzonki, zgłaszają śmieci — ktoś musi być w domu), szkółka (5 000 zł, ok. 400 sadzonek na sezon, 1 zł/szt., lepiej się przyjmują), garaż z magazynem (4 500 zł: druga terenówka, tańsza karma), podleśniczy (220 zł/dzień: drugi patrol i dyżur w kancelarii), forwarder (18 000 zł), stan koła łowieckiego i paśników.
- Zapis z 0.3 wczytuje się (składnica zamienia się w stos przy drodze B).

## Zmiany w 0.6.1 „Większy las” (z poprawkami 0.5.1)
- **Większa mapa** (ok. 2,25×): nowe oddziały 106–110 — stara świerczyna, bory sosnowe, grąd, młodniki. Nowe drogi leśne, place nawrotowe na końcach ślepych dróg. Zapis z 0.5 się nie wczyta (nowa mapa) — od 0.6.2 zapisy mają przechodzić między wersjami.
- **Mapa leśnictwa (Tab):** gatunki albo klasy wieku, oddziały, powierzchnie, stosy, ekipy i patrol; klik przenosi kamerę.
- **Baza maszyn zniknęła** — w jej miejscu rośnie las. Ciągnik usługowy przyjeżdża, gdy leżą kłody, nocuje na placu przy leśniczówce, a po robocie zjeżdża z lasu. Kupiony forwarder stoi na placu.
- **Pojazdy nie zawracają na siłę:** jadą do najbliższego skrzyżowania albo placu nawrotowego; w miejscu zawraca tylko stojące auto, gdy objazd byłby bardzo długi (i patrol w akcji).
- **Siatka zatrzymuje zwierzynę:** po ogrodzeniu powierzchni zwierzęta nie wchodzą do środka, a te, które tam były, wychodzą. **Repelent** na sadzonki — tani, chroni przez jedną porę roku (ok. 75% mniej zgryzania).
- **Myśliwy szybszy:** celuje kilka sekund i strzela (zasięg do skraju polany), przyjeżdża też o świcie. **Polowanie zbiorowe** jesienią i zimą w sobotę: linia myśliwych, naganka w pomarańczowych kamizelkach, pokot.
- **Rogi mapy:** kamera wyjeżdża poza krawędź o szerokość paneli; **U** chowa interfejs.
- Duża mapa a pamięć: ślady (koleiny, bruzdy) i kawałki lasu trzymane są tylko tam, gdzie są potrzebne; dawno niewidziane kawałki lasu są zwalniane.

## Zmiany w 0.6.2 „Gospodarka drzewostanem”
- **Jakość drzew** (dorodne / przeciętne / wadliwe) jest ukryta, dopóki leśniczy nie oceni drzewostanu. Na karcie drzewa: „Ocena drzewostanu i cechowanie” — leśniczy (albo podleśniczy) obchodzi okolicę, poznaje jakość i oznacza wadliwe drzewa do trzebieży. Przy narzędziu Wycinka oceniona jakość widać jako kolorowe kropki; na mapie leśnictwa jest widok „Jakość”.
- **Trzebież:** pojedyncze drzewa można wyznaczyć od 12 lat (zaznaczanie obszarem nadal od 25 lat). Drzewa w luźniejszym drzewostanie przyrastają szybciej, dorodne lepiej niż wadliwe.
- **Sortowanie drewna (samo):** z każdego drzewa powstaje drewno tartaczne, papierówka i opał — według grubości i jakości. Każdy sortyment trafia na osobny stos przy drodze. Ciężarówka bierze tartaczne i papierówkę; opał zostaje dla ludności (petenci kupują go w kancelarii i odbierają spod stosu, jak w Lasach Państwowych). Na karcie stosu opału można pozwolić zabrać go ciężarówce.
- **Skład gatunkowy nasadzeń:** na karcie powierzchni „Zmień skład gatunkowy” — sosna z domieszką brzozy, sosna z dębem w gniazdach, świerk z bukiem, grąd (buk z dębem) i inne.
- **Szkółka:** plan produkcji gatunków (panel L); zapas sadzonek liczony osobno dla każdego gatunku.
- **Poprawki:** rów przy szosie przerwany na wjazdach (przepusty), ślepe drogi połączone w pętle (bez placów nawrotowych), płynne przesuwanie mapy (las malowany zawczasu i trzymany w pamięci karty graficznej).
- Zapis z 0.6.1 wczytuje się.

## Zmiany w 0.6.3 (poprawki po testach)
- **Trzebież z umiarem:** to samo miejsce leśniczy cechuje najwyżej raz na ok. 10 lat (wcześniej tylko ocenia jakość), jednorazowo najwyżej 15% drzew i tylko wadliwe drzewa w zwarciu — najpierw te, które przeszkadzają dorodnym. W luźnym drzewostanie: „nie wymaga trzebieży”.
- **Cofanie zaznaczeń:** Ctrl+Z cofa ostatnie zaznaczenie obszarem (wycinka i sadzonki), Shift + przeciągnięcie odznacza drzewa.
- **Mniej dróg:** usunięte pętle przy oddz. 108 i 110. W starym zapisie las zarasta dawne drogi, a stosy z nich trafiają na najbliższą drogę.
- **Węższe pobocza:** las bliżej dróg (w starym zapisie pobocza zarastają przy wczytaniu).
- **Mniej śmieci, a część odwiedzających sprząta sama** („Grzybiarz pozbierał śmieci…” — zgłoszenie znika).
- **Rowerzyści** jeżdżą za dnia i zjeżdżają z lasu przed zmrokiem.

## Zmiany w 0.6.4 „Nowe drogi”
- Nowy układ mapy: jedna łagodnie wygięta szosa, kręte dukty w północnej części, prostokątna pętla dróg na południu (zaokrąglone narożniki), skrzyżowania naprzeciw siebie, jedna ślepa droga do mokradła. Wszystkie drogi to gładkie krzywe (jazda, malowanie i kolizje używają tej samej geometrii).
- Oddziały 101–112 w regularnej siatce przesiek (wąskie linie podziału dla pieszych i zwierząt, słupki oddziałowe). Oddział 104 to puszcza w NE bez dróg.
- Leśniczówka, plac i szkółka przy szosie na zachodzie; polany nieregularne; strumień łączący trzy mokradła (mostki/przepusty).
- Cztery stałe miejsca paśników; zarezerwowane miejsca na parking leśny, ścieżkę przyrodniczą i drogi pożarowe (kolejne wersje).
- **Zapis z wcześniejszych wersji nie działa (nowa gra) — to ostatnie złamanie zapisu.**

## Zmiany w 0.7.0 „Zdrowie lasu”
- **Szkółka leśna** stoi od początku w ogrodzonym placu w oddz. 101 (dawna „Uprawa”); kupno uruchamia produkcję sadzonek.
- **Pogoda i susza:** słonecznie / deszcz / śnieg / wichura; susza ściółki rośnie latem, deszcz ją zmniejsza; mokradła i strumień wysychają. **Zagrożenie pożarowe** (niskie / umiarkowane / wysokie) widać pod zegarem — wpływa na liczbę i szybkość pożarów.
- **Kornik drukarz:** zasiedla świerki po cichu (korony rudzieją po kilku dniach), rozprzestrzenia się szybciej w suszy. Patrol po zgłoszeniu oznacza drzewa do **cięcia sanitarnego** (drewno sanitarne jest tańsze). **Pułapki feromonowe** (1800 zł/rok) wykrywają nalot wcześniej i hamują rozprzestrzenianie.
- **Wichury:** powalają i łamią drzewa (wiatrołomy), mogą zatarasować drogi leśne — patrol je udrażnia, pojazdy omijają zatarasowane odcinki, jeśli jest objazd.
- **Wieża przeciwpożarowa** (6000 zł): pożary rozwijają się wolniej. **Zakaz wstępu do lasu:** brak grzybiarzy, spacerowiczów i rowerzystów, mniejsze ryzyko pożaru; zdejmowany automatycznie, gdy zagrożenie spada.
- Panel leśniczówki (L) ma nową sekcję „Zdrowie lasu”; zamierające drzewa widać na mapie leśnej (Tab) jako pomarańczowe punkty.
- Zapis z 0.6.4 działa (nowe pola są opcjonalne).

## Zmiany w 0.7.2 „Porządek w terenie”
- **Powierzchnie:** wielokąt jako dodatek do prostokąta (klik = kolejne punkty, Enter / klik w pierwszy punkt = zamknij, Esc = anuluj). Drogi, rowy i podwórze są wyłączone z powierzchni; pług orze tylko wewnątrz (z uwrociami), sadzonki ok. 3,5 m od drogi, ok. 2 m od rowu; ogrodzenie ma bramy przy drogach.
- **Mapa:** szlaban DP3 stoi na poboczu (nie na drodze), strumień omija skrzyżowania, wiatrołomy wyglądają jak dwa powalone pnie, kornik rozprzestrzenia się wolniej.
- **Leśniczówka** w stylu murowanej gajówki (biały tynk, czerwona dachówka, wiata z panelami PV, drewutnia), plac z płyt z oznaczonymi stanowiskami. Zabudowa leży na osobnej warstwie z wariantem zimowym (śnieg na dachach zamiast białej mgły). Ciągnik wraca na nowy plac.
- **Szkółka** jest częścią podwórza leśniczówki (dawna „Uprawa” zniknęła); kupno dodaje grządki z sadzonkami i tunel foliowy.
- **Składnice drewna:** jedno miejsce = jeden stos (tartak: grube kłody z pomarańczową etykietą, papierówka: cieńsze z niebieską, opał: luźna pryzma obok). Stosy leżą poza jezdnią i z dala od skrzyżowań; stare zapisy są automatycznie przenoszone. Kliknięcie pokazuje rozbicie na sortymenty.
- Zapis z 0.7.0 działa.

## Zmiany w 0.7.3 „Poprawki”
- **Leśniczy, petenci i pies** nie chodzą już w miejsce starej leśniczówki (stare współrzędne spacerów i bramy); leśniczy reaguje na zgłoszenia znacznie szybciej.
- **Plan na zimę** nie zawiera sadzenia (ziemia zamarznięta); premia zależy tylko od zadań możliwych do wykonania.
- **Zapisy:** dawny regularny zagajnik po „Uprawie” jest zastępowany zwykłym drzewostanem oddziału; grodzenia z zapisu od razu odgradzają zwierzynę (wcześniej siatka działała dopiero po zbudowaniu w tej samej sesji).
- **Kornik** wrócił do parametrów z 0.7.0 (brązowe korony na zrzutach to była jesień, nie kornik). Wiatrołomy zostają bez zmian.
- **Przesieki** (jasne pasy między oddziałami) nie są już malowane w świecie.
- **Okno z opcjami** pojawia się przy klikniętym obiekcie i podąża za kamerą, zamiast stać w lewym dolnym rogu.

## Zmiany w 0.7.4 „Podwórze”
- **Podwórze obejmuje plac:** ogrodzenie sięga dalej na wschód, plac ma ten sam żwir co dziedziniec i leży bezpiecznie z dala od dróg. Brama jest przy drodze dojazdowej; ciągnik wjeżdża i nocuje na placu.
- **Magazyn (kupowany)** stoi obok wiaty z panelami, a nie na niej; przed zakupem pole jest zaznaczone palikami.
- **Szkółka:** szkółka jest przeszkodą dla pieszych (leśniczy, pies, petenci); spacery leśniczego przeniesione na wolne miejsca podwórza.
- **Odstępy:** terenówki i samochody petentów parkują z odstępem.
- **Las wokół leśniczówki** podchodzi bliżej płotu i drogi; przy szosie rosną samosiejki. Stare zapisy są uzupełniane automatycznie.
- **Zima:** płot, znaki DP, szlabany, tablice i słupki leżą na warstwie rysowanej po mgiełce i nie są już wyszarzone.
- **Zlecenia:** przycisk/klawisz **X** anuluje niewysłane oznaczenia i zlecenia, których ekipa jeszcze nie zaczęła; Ctrl+Z cofa też zlecenia wysłane do ekipy, jeśli prace się nie zaczęły.
- **Pniaki** próchnieją i znikają po 6–10 latach, ale tylko na obszarach już odnowionych; nieodnowione zostają jako sygnał do sadzenia (liczą się nadal do wskaźnika odnowienia).
- **Siatka:** gdy sadzonki wyrosną (ok. 10 lat), pojawia się zgłoszenie demontażu siatki; zaniedbana siatka po ok. 15 latach niszczeje sama.

## Zmiany w 0.8.1 „Skrzynka i spokój na x10”
- **Skrzynka pocztowa** przy bramie podwórza: czerwona flaga w górze = nowe listy. Klik w skrzynkę albo **C** otwiera Pocztę (nowe listy podświetlone, klik w treść przenosi kamerę w miejsce zdarzenia). Trafiają tu zdarzenia, które dotąd znikały w komunikacie po 3 s: pożar ugaszony przez straż, ucieczka quada/intruza, wichura, wynik oceny drzewostanu i kornika, pismo z planem na porę roku, wykonanie planu, debet, zbiorcze informacje o wygasłych zgłoszeniach. Poczta jest zapisywana (40 ostatnich listów).
- **Ochrona przed zawałem na wysokim tempie:**
  - pilne zgłoszenia (pożar, nielegalny wjazd, nocny intruz) same cofają czas do ×1;
  - maksymalnie 7 otwartych zgłoszeń; nadmiar drobiazgów (śmieci, propozycje demontażu siatki) odpada — najpierw najmniej pilne i najstarsze;
  - śmieci, których nikt nie ruszy przez ok. 2 dni gry, wygasają bez kary i wracają do zgłoszeń po ok. półtora dnia;
  - dzienna kara za zalegające zgłoszenia zależy od wagi (drobiazg 1, zwykłe 3, pilne 3; propozycje 0) i ma sufit 9 punktów na dzień.
- **Karta oddziału** (klawisz **O**, albo przycisk „Karta oddziału” na karcie drzewa i powierzchni): skład gatunkowy, liczba drzew i sadzonek, średni wiek, miąższość, drzewa dojrzałe i do trzebieży, stan oceny jakości, oznaczone do cięcia, zamierające, pniaki i nieodnowione, powierzchnie odnowieniowe, otwarte zgłoszenia i data ostatniego cechowania. Dla oddziału pod zaznaczonym obiektem albo środkiem ekranu.

## Zmiany w 1.4.3
- Światło z okien leśniczówki: miękka, spłaszczona poświata przy ścianie zamiast dwóch ostrych kół.
- Sygnały świetlne migają w kolorze pojazdu: Policja i straż na niebiesko (oba światła Policji niebieskie), leśniczy na pomarańczowo.
- Forwarder jako „łamaniec”: przedni człon z silnikiem i kabiną, przegub w połowie i tylny człon z żurawiem i kłonicami, bez dyszla; skręt łamany do ok. 43°.
- Wynajem drugiego forwardera (czerwony) w Leśniczówce → Kadry i sprzęt: 900 zł do końca pory roku, zrywka 12 zł/m³ jak własnym. Pracuje równolegle z pierwszą maszyną i nie jedzie po te same kłody.

## Zmiany w 1.4.2
- Snopy reflektorów w kształcie lejka: wąskie przy aucie, dalej rozchodzą się prostymi krawędziami, koniec zaokrąglony i wygaszony; miękkie brzegi.

## Zmiany w 1.4.1
- Reflektory nocą: zamiast jednego trójkątnego snopa ze środka — dwa owalne snopy z obu reflektorów, lekko rozchodzące się na boki. Ciężarówki i maszyny świecą dalej niż osobówki.

## Zmiany w 1.4.0 „Wywóz i intruzi”
- **Dwie ciężarówki z żurawiem HDS.** *BDF* (bordowa kabina, kłonice wzdłuż ramy, żuraw z tyłu) przyjeżdża już od 5 m³, jest szybsza, częściej odbiera i jako jedyna wjeżdża na dukty. *Dłużyca* (granatowa kabina, czerwony żuraw za kabiną) przyjeżdża, gdy przy drogach leśnych leży ponad 20 m³; pusta wozi wózek do dłużycy złożony na ramie, przy pierwszym stosie zdejmuje go żurawiem i podpina z tyłu. Ręczne „Zamów wywóz” na karcie stosu wysyła wolną BDF, a gdy jest w drodze — dłużycę.
- **Chrust** (gałęzie po ścince): kupkę da się kliknąć. Przy drogach i duktach zbierają go petenci z zezwoleniem (40 zł w kancelarii) — przyjeżdżają osobówką z przyczepką, ładują gałęzie i odjeżdżają. Chrustu w głębi lasu nikt nie zbiera: butwieje sam po ok. 10 latach.
- **Intruzi bardziej realnie.** Bez kontroli wjazdów (fotopułapek) złodzieja drewna, złodzieja choinek i kłusownika widać tylko wtedy, gdy jest blisko leśniczy, podleśniczy, ekipa albo myśliwy (z ambony widzi dalej). Kogo nikt nie zauważył, o tym dowiadujesz się rano z poczty (np. pniaki po wyciętych choinkach) — bez kary za brak reakcji. Znacznik zgłoszenia jedzie za autem intruza, patrol goni odjeżdżającego, a „zatrzymany” pojawia się tylko po dogonieniu. Kto uciekł przed patrolem, ucieka bez kary i bez sprzecznych komunikatów; wnyki zebrane, jeśli sprawca już odjechał.
- **Przyczepy, naczepy i wózki** są przeszkodą: inne pojazdy zwalniają przed nimi i je omijają, zamiast po nich przejeżdżać.
- Stroje ekip: cięcie — neonowy pomarańcz, sadzenie — neonowa zieleń (busy bez zmian).
- Znak zakazu wjazdu stoi na pasie trawy tuż przy jezdni, a nie w koronie drzewa.
- Naprawione: od 1.3.0 po wczytaniu zapisu nie wracały etat cięć z bieżącej pory roku, wybrany gatunek sadzonek i zamówiony wywóz.

## Zmiany w 1.3.3
- Susza na mokradłach: zamiast brązowej elipsy, która zasłaniała brzegi, dopływ i drogę, lustro wody cofa się do środka w obrębie swojego kształtu (spękany muł przy brzegu). Zimą, gdy woda jest zamarznięta, nie ma śladu suszy. Strumień w suszy płycieje węższym pasem.
- Znaki zakazu wjazdu stoją na poboczu drogi leśnej, ok. 70 px od szosy (nie na wylocie), po stronie bez parkingu.
- Fotopułapki są niewidoczne (w rzeczywistości są ukryte); działają jak dotąd.

## Zmiany w 1.3.2
- Polowanie zbiorowe w oddz. 106: od przebudowy mapy w 0.9 linia myśliwych leżała na samej drodze, przy zaparkowanych autach, a naganka ruszała spod polany za daleko. Stanowiska stoją teraz w lesie ok. 50 px na wschód od drogi, a naganka idzie równą linią od polany w ich stronę.

## Zmiany w 1.3.1
- Ambony i paśniki znowu rysują się pod koronami drzew, tak jak przed 1.2.1 (rysowanie nad koronami wyglądało źle). Gdzie stoją, pokazuje Mapa leśnictwa (Tab).

## Zmiany w 1.3.0 „Mniej przycisków”
Wydanie po audycie uproszczeń: mniej rzeczy do pamiętania, więcej dzieje się samo.
- **Dwie ekipy:** stała ekipa cięcia (pomarańczowe stroje, biały bus) i stała ekipa sadzenia (zielone stroje, zielony bus). Płacisz tylko za pracę: ścinka za m³ (sanitarną nadal nadleśnictwo), sadzenie w cenie sadzonki. Dawna ekipa B na dniówki znika. W Kadrach można wynająć dodatkową ekipę cięcia albo sadzenia do końca pory roku (600 zł jednorazowo, praca płatna jak u stałych).
- **Kolejka ekip:** najpierw cięcia sanitarne, potem najstarsze zlecenie razem z zadaniami w zasięgu chodzenia (gra zapamiętuje czas oznaczenia). Sadzenie nie blokuje już wycinki.
- **Sadzenie:** w narzędziu 3 nad paskiem wybierasz gatunek (sosna, świerk, dąb, buk, brzoza); klik i rzędy sadzą wybrany. Przy pniaku zawsze gatunek pniaka (wcześniej gatunek przeważający w oddziale).
- **Szkółka bez planu:** jeden zapas sadzonek wszystkich gatunków — ze szkółką każda sadzonka jest tańsza.
- **Bez przełączników odnowienia:** pojedyncze sadzonki i przy pniakach zawsze na placówkach, orka tylko na powierzchniach. W puszczy (oddz. 104) i w rezerwatach pniaki odnawiają się same, a martwe drzewa zostają w lesie (bez przycisku na karcie drzewa).
- **Patrol:** pilne zgłoszenie (pożar, quad, nocny intruz) przerywa jazdę do zwykłego zadania, a przerwane wraca na początek kolejki. Quada, crossowca albo intruza mijanego po drodze leśniczy zatrzymuje sam, bez zgłoszenia.
- **Dukty:** zrywka układa stosy także przy duktach (pod nową składnicą wycina kilka drzew), ciężarówka wjeżdża na dukty i zawraca na ich końcach za krawędzią mapy. Przy otwartych szlabanach ok. 30% odwiedzających jedzie na dukty. Na dukcie auta z naprzeciwka mijają się, zjeżdżając na pas zieleni (bez mijanek i placów).
- **Leśniczówka:** 5 zakładek zamiast 7 (Kadry i sprzęt · Finanse z podsumowaniem kosztów · Las · Ochrona terenu · Przyroda i łowy). „Kontrola wjazdów” = fotopułapki i znaki zakazu jednym zakupem. „Odstraszacze przy szosie” nazywają się „Znaki i odblaski przy szosie”. Zakaz wstępu ogłasza i znosi samo nadleśnictwo przy najwyższym zagrożeniu pożarowym (list w Poczcie, bez opłat). Bez repelentu na powierzchnie (zostaje grodzenie). Bez ręcznego „zostaw opał dla ludności” — działa tylko reguła zapasu.
- **Wywóz drewna:** bez przycisku i klawisza K — ciężarówka przyjeżdża sama od 10 m³, wcześniej „Zamów wywóz” na karcie stosu.
- **Poczta:** trzy zakładki (Wszystkie, Zdarzenia, Przyroda); faktury płaci się w Finansach.
- Zapisy z 1.2.x wczytują się: zapas szkółki sumuje się, zlecenia wracają do właściwych ekip, dawna ekipa B nie wraca.

## Zmiany w 1.2.1
- **Ambony i paśniki:** z 8 kupionych ambon dwie były całkiem zakryte koronami, a kilka wystawało tylko rogiem dachu (podobnie paśniki P3 i P4) — stąd „brakujące” ambony. (Rysowanie nad koronami cofnięte w 1.3.1.)
- **Mapa leśnictwa (Tab):** na każdej warstwie widać postawione ambony (brązowy domek, A1–A8) i paśniki (żółty żłób, P1–P4); pusty paśnik zimą ma czerwoną obwódkę. Najechanie kursorem pokazuje nazwę ambony z liczbą wyjść i pozyskaniem albo poziom karmy w paśniku.

## Zmiany w 1.2.0
- **Autobus szkolny:** wycieczki na ścieżkę przyrodniczą przyjeżdżają żółtym autobusem. Przy otwartych szlabanach autobus wjeżdża duktem najbliżej ścieżki, przy zamkniętych staje w zatoczce przy szosie pod znakiem ścieżki. Dzieci z leśniczym wysiadają, idą lasem do ścieżki, przechodzą ją, wracają i autobus odjeżdża.
- **Quady i crossy** przed zamkniętym szlabanem zjeżdżają w las, objeżdżają wolny koniec rury i wracają na drogę.
- **Ruch pojazdów (etap A):** stojące pojazdy (zaparkowane, pracujące w terenie, stojące u celu) są objeżdżane drugą połową drogi zamiast przejeżdżania po nich; pojazdy z boku na skrzyżowaniu zatrzymują nadjeżdżającego (pierwszeństwo ma szosa, potem kto pierwszy); przenikanie przez inny pojazd tylko po 12 s zakorkowania (wcześniej 6 s). Mijanie z naprzeciwka bez zmian (etap B).

## Zmiany w 1.1.9
- Ramię żurawia ciężarówki nie sięga już przez pół mapy: drewno z jadącej maszyny zapisywało się czasem jako stos przy dukcie lub szosie, dokąd ciężarówka nie dojeżdża, i ładowała je z daleka. Takie stosy przenoszą się przy wczytaniu do najbliższej drogi leśnej, a ciężarówka bez dojazdu do stosu jedzie do następnego.

## Zmiany w 1.1.8
- Odwiedzający (grzybiarze, zbieracze, petenci, auto z odpadami) nigdy nie otwierają zamkniętego szlabanu. Przy odjeździe zawracają: z zatoki parkingowej łukiem przez parking, z pobocza na drodze, i wracają do szosy tą samą drogą (trasa omija odcinki ze szlabanami). Zawraca jedno auto naraz na danym dojeździe.
- Przy zbudowanym parkingu odwiedzający stają tylko na parkingu (gdy pełny — rezygnują); pobocze przed szlabanem tylko wtedy, gdy parkingu nie ma.
- Kto wjechał do lasu przed zamknięciem szlabanu, wyjeżdża przez szlaban (otwiera i zamyka).

## Zmiany w 1.1.7 „Szlabany naprawdę działają”
- Zamknięte szlabany zatrzymują auta odwiedzających: zbieracze i grzybiarze stają na parkingu, a gdy go nie ma albo jest pełny — na poboczu przed szlabanem (2 miejsca przy każdym wjeździe) i dalej idą pieszo; bez miejsca rezygnują. Rowery, quady i crossy przejeżdżają obok.
- Ekipy, ciągnik i forwarder, ciężarówka, pług, śmieciarka, myśliwi, odbiór opału i patrol: przed zamkniętym szlabanem kierowca wysiada, otwiera, pojazd przejeżdża i staje, kierowca zamyka; kilka pojazdów naraz — zamyka ostatni. To samo przy wyjeździe.
- Straż pożarna i Policja: szlaban otwiera się przed nimi bez postoju i zamyka po przejeździe.
- Przy zamkniętych szlabanach dzikie wysypiska powstają przed szlabanem, a nocni intruzi wjeżdżają duktami spoza mapy.
- Uwaga: każdy przejazd przez zamknięty szlaban to kilkanaście minut gry; zrywka i wywóz są przez to wolniejsze (w teście ok. 15% mniej m³ w dwóch porach roku).

## Zmiany w 1.1.6
- Drzewa w pasie za szosą (tło, poza gospodarką), uszkodzone tam przez wichurę lub kornika przed 0.9, wracają przy wczytaniu do zdrowia i znikają z licznika „Zamierające drzewa”.

## Zmiany w 1.1.5 „Przeliczona ekonomia”
- **Ścinka zależna od wielkości drzewa:** 30 zł + 55 zł/m³ (zamiast 110 zł za każde drzewo). Trzebież kosztuje grosze, od ok. 40 lat każde drzewo jest na plus, brzoza też.
- **Cięcia sanitarne** (wiatrołomy, kornik) — ścinkę opłaca nadleśnictwo; drewno nadal się sprzedaje.
- **Forwarder:** zrywka własnym 12 zł/m³ (usługa 40 zł/m³), utrzymanie 60 zł za dzień pracy.
- **Utrzymanie leśniczówki** (dawne 300 zł dziennie) pokrywa nadleśnictwo — dzień bez pracy nic nie kosztuje; płacisz tylko za to, co dokupisz (ekipa B, podleśniczy, fotopułapki, parking, odstraszacze).
- **Hurtowy odbiór opału:** ponad ok. 10 m³ opału przy drogach nadwyżkę zabiera ciężarówka (taniej niż petenci). Stos „Zostaw dla ludności” zostaje.
- **Etat cięć:** 60 m³ z rębni (drzewa dojrzałe) na porę roku; ponad etat ekipa czeka do nowej pory roku. Trzebież i cięcia sanitarne bez limitu. Etat widać w planie sezonu, w Leśniczówce (Las i porządek) i na karcie drzewa.
- **Odnowienie małych luk:** sadzenie ręczne na placówkach (+1,50 zł za sadzonkę, przyjmuje się ok. 85%; bez placówek ok. 55%, po orce ok. 90%) — przełącznik w Leśniczówce. Pniak z drzewem nasiennym obok można **zostawić do odnowienia naturalnego** (karta pniaka, karta oddziału): za darmo, nie obniża Stanu lasu, po 1–2 porach roku wyrastają samosiewy albo gra informuje, że trzeba posadzić.
- **Podsumowanie kosztów:** ścinka rozbita na rębnię, trzebież i sanitarną; raport sezonu pokazuje wykorzystanie etatu i wynik odnowienia naturalnego.

## Zmiany w 1.1.4
- Leśniczówka → zakładka **Podsumowanie kosztów**: przychody i koszty według kategorii za tę porę roku, poprzednią, bieżący rok albo od początku; wynik z gospodarki (bez pożyczki), osobno pożyczka; „Wycinka w liczbach” (drzewa, koszt ścinki i zrywki na drzewo, sprzedane m³ i cena za m³, opał). Praca ekip liczy się w dniu wykonania, kary za zwłokę w dniu zapłaty. Zapisy sprzed 1.1.4: odtwarzane są tylko faktury zachowane w zapisie, reszta liczy się od wczytania.

## Zmiany w 1.1.3
- Wskaźniki (budżet, stan lasu, ochrona, plan) stoją na środku wolnego miejsca, a nie przy zegarze; lista planu sezonu nie wchodzi na panel zegara.
- Panel Zgłoszeń pokazuje stan patrolu (leśniczy, podleśniczy: gdzie jest, do którego oddziału jedzie; klik pokazuje go na mapie) — grupa Patrol zniknęła z lewego dolnego panelu. Przycisk „Q Wyślij · N” pojawia się tylko, gdy są nowe zgłoszenia.

## Zmiany w 1.1.2 (razem z 1.1.1) „Trwały zapis i porządek HUD-u”
- **Zapis zobowiązań:** po wczytaniu opłacona orka wraca do kolejki pługa bez dopłaty; zlecona wycinka i sadzenie (także przerwane sadzenie na powierzchni) wracają do ekip, które ruszają same o 7:00; zgłoszenia w kolejce i w toku wracają do patrolu bez ponownej opłaty za wyjazd; opłacony wywóz wysypiska czeka na śmieciarkę; śmieci, wnyki, wysypiska i zarzewia zostają w lesie (odświeżenie strony nie sprząta lasu). Quad lub nocny intruz znika podczas przerwy — kara tylko, jeśli zgłoszenie wisiało bez reakcji.
- **Raport sezonu** liczy cały sezon, także pracę sprzed wczytania (statystyki sezonu są w zapisie). Drewno w jadącym ciągniku, forwarderze i ciężarówce zapisuje się jako stos przy drodze.
- **Ekran startowy:** Enter wczytuje zapis; „Nowa gra” (także w Pomocy) przy istniejącym zapisie wymaga drugiego kliknięcia. Karta przewija się przy niskim oknie, Tab przechodzi między przyciskami.
- **Klawiatura:** skróty przeglądarki (Ctrl/Cmd/Alt + litera) nie uruchamiają akcji gry; testowe postarzanie lasu (G) działa tylko w trybie diagnostycznym (F3). Samouczek znów otwiera się przy nowej grze.
- **Pauza** zatrzymuje tylko symulację: karty drzew, obiektów i planowanie działają. Komunikaty znikają według czasu rzeczywistego, przy otwartym oknie pokazują się u góry ekranu. „Do jutra” mówi, dlaczego nie przewija (interwencja, pożar, intruz, nowe zgłoszenie).
- **HUD:** prawa kolumna to jeden stos (zegar, zgłoszenia, pasek pniaków) — panel zegara nie zmienia wysokości w nocy. Zgłoszenia jako wiersze: kropka typu, nazwa, oddział, przycisk albo stan; najwyżej 4, reszta w oknie Ochrona terenu. Plan sezonu rozwija się pod przyciskiem (paski postępu, premia, czas do końca pory roku). Panel ekip w grupach Ekipy / Zrywka i wywóz / Patrol z kropkami stanu; klik w wiersz pokazuje jednostkę. „Do zapłaty” jest pod budżetem (klik → Finanse). Litery HUD-u 11–12 px.
- **Koszty jawne:** oferta forwardera pokazuje przed zakupem utrzymanie (140 zł za dzień pracy) i korzyści; koszty dzienne rozbite na stałe i płatne tylko za dni pracy (ekipa B, forwarder). Raport sezonu pokazuje osobno wywóz ciężarówką i opał sprzedany w kancelarii.
- Okna bez zbędnego poziomego suwaka.

## Zmiany w 1.1.0 „Czytelne okna”
**Wskaźniki.** Klik w pasek **Stan lasu** albo **Ochrona terenu** otwiera okno z rozbiciem na składniki i punkty oraz opisem, co poprawić.
- Stan lasu = 32 (podstawa) + do 50 (korony) + do 8 (młode uprawy, pełne przy 150 drzewkach) − pniaki bez odnowienia (0,35 pkt za sztukę, najwyżej −15) − śmieci − pożary − szkody. Sadzenie dodaje punkty (wcześniej tylko ograniczało straty), maksimum to 90%.
- Raport z sezonu liczy się z rzeczy, na które gracz ma wpływ (pniaki bez odnowienia, zgłoszenia, plan), a nie z całego wskaźnika.
- **Pokaż nieodnowione pniaki**: pierścienie nad koronami (żółte: do posadzenia, zielone: sadzonka zaplanowana), pasek pod Zgłoszeniami z przyciskami „Posadź przy wszystkich” i „Wyłącz”. Esc też wyłącza.
- Okno Ochrony terenu: otwarte zgłoszenia z kosztem na dobę, przyciski „Pokaż” i „Wyślij patrol”, dziennik ostatnich zmian z powodami (zapisywany w grze) i krótkie zasady.

**Mapa leśnictwa (Tab)** w wielkim oknie: płaskie kolory komórek zamiast kropek, warstwy Gatunki / Wiek / Odnowienie / Prace (warstwa „Jakość” usunięta), odczyt wartości pod kursorem (oddział i komórka), tabela 8 oddziałów. Klik w mapę: kamera i karta oddziału. Klik w wiersz tabeli: pokaż cały oddział.

**Poczta (C)** jako okno jak Leśniczówka (gra stoi): zakładki Wszystkie / Faktury / Zdarzenia / Przyroda / Plan, grupy dniami, pierwsze zdanie jako tytuł, „Pokaż na mapie”. Faktury płaci się tylko w Leśniczówce (Finanse); w poczcie jest „Przejdź do finansów”, a wiersz „Do zapłaty” na dole też otwiera Finanse.

**Panel sterowania**: duży zegar, jedna linia daty z dniem tygodnia, jedna linia pogody i zagrożenia pożarowego, tempo jako przyciski ×1 ×2 ×3 obok pauzy (×10 tylko Shift), osobny przycisk „Do jutra”, jeden przycisk Menu (ustawienia, samouczek, pomoc). Usunięte: przyciski zoomu (kółko myszy), dźwięku (jest w Menu i pod M), osobne „?” i „⚙”. Przycisk Mapa przeniesiony do dolnego paska, „Q Wyślij patrol” jest przyciskiem nad listą zgłoszeń.

**Karta oddziału (O)**: większy druk, trzy sekcje (Drzewostan z paskiem gatunków, Do zrobienia, Stan), granice oddziału podświetlone w świecie (ramka i przyciemnione otoczenie), „Pokaż cały oddział” (dopasowanie kamery) zamiast „Pokaż środek”, „Posadź przy nieodnowionych pniakach (N)”, rezerwat.

## Zmiany w 1.0.3
- Pniak: po zaplanowaniu sadzonki przycisk znika, a karta pokazuje „Sadzonka zaplanowana”. Wcześniej każde kliknięcie przestawiało sadzonkę albo wyświetlało komunikat.
- Bielik i bocian czarny latają dalej: wyprawy do ok. 1000 px od gniazda, co 2–6 minut gry.
- Pojedyncze, ręcznie zaplanowane sadzonki są znowu widoczne bez wybranego narzędzia (jak oznaczone drzewa). Sadzonki z powierzchni pokazują się tylko przy narzędziach sadzenia.

## Zmiany w 1.0.2
- Poprawka: po załatwieniu sprawy radiowóz Policji odjeżdża (wcześniej wpis interwencji znikał, gdy policjanci jeszcze stali, i radiowóz zostawał na drodze na stałe). Dodane zabezpieczenie: radiowóz bez aktywnej interwencji sam odjeżdża.

## Zmiany w 1.0.1 „Jeden interfejs”
- **Układ:** lewa kolumna zniknęła. Narzędzia (1–4) i akcje (ekipa, anulowanie, wywóz, poczta, Leśniczówka, cofnij, śledź) są na dolnym pasku z podpowiedzią narzędzia. Status ekip, zrywki i patrolu jest w lewym dolnym rogu. Plan na sezon to przycisk przy wskaźnikach (rozwija się w małe okno).
- **Styl:** wszystkie plansze i okna mają tę samą ramkę z kory i mchu oraz pasek nagłówka. Karty obiektów (drzewo, pojazd, zgłoszenie, powierzchnia, oddział, poczta, decyzja patrolu) wyglądają jak okna: nagłówek z tytułem i ✕, wiersze, przyciski u dołu. Zamykanie: ✕, Esc, klik w puste miejsce.
- **Teksty:** komunikaty, karty, poczta, pomoc, samouczek i intro przepisane krócej i konkretniej; usunięte rozwijane „Jak to działa”.
- **Powierzchnie odnowieniowe:** mgła, etykieta i kwadraciki planowanych sadzonek tylko przy narzędziach 3/4 lub przy zaznaczonej powierzchni; poza tym cienka przerywana linia.

## Zmiany w 1.0 „Spokojna piaskownica”
- **Interfejs:** okna w lekkim leśnym stylu (zielono-brązowa ramka, nagłówek z ✕). Każde okno zamyka ✕, **Esc** albo klik w tło; spójny układ (tytuł, treść, przyciski). Okno **Leśniczówki (L)** ma teraz zakładki: Kadry · Budynki i sprzęt · Finanse · Las i porządek · Przyroda · Łowiectwo, pasek podsumowania (budżet, koszty, faktury, zagrożenie pożarowe) i rozwijane „ⓘ Jak to działa”.
- **Samouczek** (6 kroków, przy nowej grze; ponownie z pomocy `?` albo ustawień) i **Ustawienia** (⚙): dźwięk, głośność, tempo na początku gry, podpowiedzi narzędzi, samouczek. Ustawienia zapisują się osobno od zapisu gry. Pomoc (`H`) skrócona.
- **Faktury — kary za zwlekanie** (bez końca gry): po terminie upomnienie (+5%, min. 40 zł) → po kolejnej porze roku wezwanie do zapłaty (+10%, min. 80 zł; **ekipy nie przyjmują nowych zleceń** do czasu zapłaty) → po trzech porach roku windykacja (+15%, min. 150 zł; bank sam ściąga należność). Płacenie automatyczne omija wszystko.
- **Pożyczki:** 5 000 zł (6%, 4 raty), 15 000 zł (8%, 6 rat), 25 000 zł (10%, 8 rat); jedna naraz.
- **Strumień i mokradła:** dopływ rozbija się na cienkie strużki w pasie błota, odpływ to wąska smuga poszerzająca się dalej; źródło w mokradle NW wypływa spod trzcin. Jedna maska wody dla mokradła i strumienia (nic nie zasłania bagna).
- **Mokradła nieprzejezdne** dla ludzi, zwierząt i pojazdów (z wyjątkiem poboczy dróg); sam strumień zwierzęta przebrodzą, pojazdy przejadą.
- **Ekipy** chodzą pieszo po skupisku zadań (do ok. 500 px) i parkują w jednym punkcie — koniec ze „przesiadaniem się” na kilka pikseli.
- **Pas za szosą:** bez kornika, wiatrołomów, zgłoszeń i nie da się go kliknąć. Narzędzie Wycinka: klik w puste miejsce odznacza wybór (okno drzewa zamyka się).
- Nie wchodzą: rewiry (odpadły) i wolniejszy wzrost drzew (zostaje jak jest).

## Po 1.0 (lista pomysłów, nic z tego nie jest obiecane)
- spowolnienie pojazdów przy brodzeniu przez strumień; więcej gatunków ptaków i zwierząt; kolejne ścieżki przyrodnicze.

## Zmiany w 0.9 (final) „Ludzie i przyroda”
- **Czas:** tempo ×1 / ×2 / ×3 (×10 tylko świadomie: Shift + klik na „Czas”). Przycisk **„Do jutra” / „Do rana”** przewija czas do 6:00 i sam się przerywa przy nowym zgłoszeniu, interwencji, pauzie albo oknie. Noc nadal przewija się sama (×8), gdy nic się nie dzieje. Pilne zdarzenia wracają do ×1.
- **Mysz zamiast skrótów:** przyciski „−” / „+” (zoom), „Cofnij” (Ctrl+Z) i „Śledź” (F); kamera przesuwa się przeciągnięciem mapy. Skróty klawiszowe nadal działają.
- **Faktury zamiast natychmiastowej zapłaty:** ścinka, sadzenie i zrywka trafiają na dzienną fakturę (poczta C → „Zapłać”, albo „Zapłać wszystkie” i automatyczne płacenie w L → Finanse). Termin: jedna pora roku; potem **jedno** upomnienie z opłatą 5% (min. 40 zł) i koniec — bez innych kar. W panelu: „Do zapłaty”.
- **Pożyczka:** 10 000 zł, 8%, 6 równych rat potrącanych na początku każdej pory roku (rata może iść na debet); spłata całości w dowolnym momencie.
- **Rzadkie ptaki** (każdy gatunek tylko raz): bocian czarny (puszcza, oddz. 104) i bielik (mokradło NW) osiadają na stałe w gnieździe na starym drzewie i latają nad lasem; żuraw i puchacz to goście, którzy zostają na chwilę i odlatują. **Strefa ochronna** gniazda: 55 px cały rok, 160 px wiosną (okres lęgowy) — bez cechowania i cięcia (rysowana przerywanym kołem). Dziennik obserwacji i wpisy w poczcie (L → Przyroda).
- **Pomnik przyrody** (drzewo od 110 lat, 600 zł, maks. 3), **rezerwat** (karta oddziału O, 2 500 zł, maks. 2: bez wycinki, martwe drzewa zostają, +ochrona co sezon), **martwe drewno** (przycisk na martwym drzewie: zostaje do 10× dłużej i nie jest cięte sanitarnie). Wszystko zwiększa „bogactwo przyrody” i szansę na przylot rzadkich ptaków.
- **Znaki i edukacja** (L): znaki zakazu wjazdu przy wjazdach w las (mniej nielegalnych wjazdów), odstraszacze zwierzyny przy szosie (znaki A-18b i słupki z odblaskami; potrąceń ok. 70% mniej, 10 zł/dzień), **ścieżka przyrodnicza** (SE, 4 tablice, brama) z **wycieczkami szkolnymi** w dni robocze (180 zł i trochę ochrony za każdą).
- **Wiatrołomy:** leśniczy oceniający drzewostan sam cechuje wiatrołomy do cięcia sanitarnego; nowe, wyraźnie różne kolory (kornik rudy, martwe szare, wiatrołom ciemnobrązowy z drzazgami; zimą na liściastych tylko rzadkie gałązki).
- **Poprawki mapy i incydentów:** szlaban za zjazdem do leśniczówki, pas za szosą niedostępny (nie cechuje się go), rów bez starych wjazdów, płynne połączenie strumienia z mokradłem, brak kary −5% gdy intruz zdążył uciec, policja i straż wysiadają z wozów, quady i crossy na publicznej szosie nie wywołują ostrzeżenia, dopóki nie skręcą w las. Chrust (kupki) można usunąć, ekipy chodzą pieszo między drzewami zamiast jeździć autem.

## Zmiany w 0.9 (etap 1) „Ambony”
- **Ambony** (1 100 zł, 8 stałych miejsc A1–A8; kupujesz w Leśniczówce, L — kolejna pojawia się w swoim miejscu na mapie): każda ma **własnego myśliwego** (wieczór i świt, przesunięci w czasie), zasięg ok. 420 px i licznik pozyskania. Wyjście daje widoczny strzał oraz porcję „z obwodu” zależną od presji zwierzyny. Jedna ambona utrzymuje stan wyjściowy (test 8 lat: presja ok. 0,95); przy zaległościach kolejne ambony pomagają (test: zaległość sarny 108/jelenie 25/dziki 140 — 1 ambona: presja 1,6 → 1,03 w 3 lata, 4 ambony: 1,06 po roku). Najwyżej 3 myśliwych naraz widać w lesie, pozostałe wyjścia liczą się bez sceny.
- **Paśniki:** nowa gra zaczyna z jednym; kolejne (700 zł, maks. 4) kupujesz w Leśniczówce — pojawiają się w stałych miejscach. Jeden paśnik obejmuje 70% lasu, cztery — całość; mniej paśników to większe straty zimą i mocniejsze zgryzanie. Stare zapisy mają wszystkie cztery.
- **Zwierzyna:** rozród zależy od zagęszczenia (bez polowań liczebność ustala się ok. 2,5× ponad docelową zamiast rosnąć bez końca), plan łowiecki = 90% nadwyżki ponad 80% stanu docelowego (maks. połowa populacji).
- **Ekipy:** w pierwszej kolejności tną drzewa z kornikiem (zgłoszenia sanitarne), a patrol z oznaczonymi korowymi drzewami wysyła je sam; max. zasięg chodzenia od auta ok. 210 px, a nowe zadania w zasięgu bierze się bez wracania do auta (koniec z przejazdami o kilka pikseli).
- **Maszyny leśne** (forwarder, ciągnik, pług, quady) omijają podwórze leśniczówki; wjeżdżają tylko na plac.
- **Mniejsza mapa (etap 1 przebudowy):** południowa część mapy (poniżej szosy) wycięta — zostaje 3600 × 1850 px, oddziały 101–108 i wąski pas za szosą. Jedna **główna pętla**: szosa j1–j2 + droga leśna przez leśniczówkę (j1–a3–a1–b1–j2). **Stare zapisy nie pasują** (nowy klucz zapisu) — zaczyna się nową grę.
- **Dukty** (nowy rodzaj drogi, wąskie, zielone, widoczne z góry, drzewa rosną tuż przy nich, korony nadal prześwitują): D1 w puszczę (oddz. 104, NE), D2 do nowego mokradła bielika (ślepy, plac nawrotowy, mała polana, paśnik P2), D3 prosto na północ, D4 przez polanę na wschód. D1, D3 i D4 **wychodzą za krawędź mapy**. Wjeżdżają: terenówka leśniczego, ekipy (busy), ciągnik, forwarder, pług, quad/cross, wóz strażacki i Policja; **nie** wjeżdża ciężarówka, śmieciarka, auta odwiedzających i rowery. Stosy drewna zawsze leżą przy drogach głównej pętli.
- **Intruzi:** quady i crossy wjeżdżają też z końców dukt za krawędzią mapy (omijają szlabany; szlabany ograniczają je tylko częściowo). Fotopułapki wiszą też przy trzech wyjściach dukt.
- **Parking:** jedna zakupiona inwestycja (3 500 zł) buduje zatokę przy **obu** wjazdach w las (j1 i j2); dwa wjazdy ze szlabanami.
- **Woda:** nowe mokradło NW (źródło strumienia) → strumień → mokradło przy leśniczówce → środek mapy → wypływ przez południową krawędź. Nowy wygląd: strumień szerszy w dole, brzegi z trzcinami, kamieniami i wierzbami; mokradła z wysepkami, grążelami i martwymi pniami. Drzewa nie rosną w wodzie.
- **Polany:** trzy — główna z amboną (dukt D4 przechodzi przez nią), północna przy D3 i mała przy końcu D2.

## Zmiany w 0.8.4 „Stabilność”
- **Zawieszenia:** błąd w jednym podsystemie nie zatrzymuje już pętli gry (wyjątek w `incidents.js`: zmienna `U` przesłaniała listę jednostek). Dodany strażnik wykrywa martwą pętlę klatek, okno blokujące grę bez okna i stojący czas. Diagnostyka w konsoli: `__lasDiag()`.
- **Wydajność:** lista padających drzew zamiast filtrowania wszystkich, rzadsze przeliczanie odnowień, zabezpieczenia przed nieskończonymi pętlami.
- **Poza mapą:** kłody nie padają i nie leżą poza krawędzią świata, a wszystko, co wystaje za krawędź, jest przycięte.
- **Sadzenie:** rzędy rzadsze (26×22 px zamiast 18×16), kliknięcie wybiera drzewo o najbliższym pniu.
- **Parking** leży pod szlabanem, **pogorzelisko jaśnieje** przez rok gry, **straż pożarna** nie krąży przy leśniczówce.
- Auta zwalniają tylko przy skręcie, maszyny leśne nie pracują na drodze głównej, quady i crossy zjeżdżają w las.

## Zmiany w 0.8.3 „Poprawki i wędrowne wilki”
- **Godziny pracy:** ekipy 7–17 (nowe zlecenie do 16:30), zrywka bez zmian (7–17), ciężarówki 6–22; sobota do 13:00, niedziela wolna (dla wszystkich).
- **Zrywka:** ciągnik i forwarder wracali na plac przy leśniczówce prosto przez las i płoty (droga do leśniczówki ma typ „drive”, którego maszyny nie używają, więc planer nie znajdował trasy). Teraz jadą drogą leśną do skrzyżowania, a dalej po podwórzu.
- **Ekonomia:** wycinkę można zlecać na debecie do −8 000 zł (żeby z minusu dało się wyjść); koszty dzienne ekipy B i forwardera liczone tylko za dni, w których pracowały; wywóz drewna automatycznie od 10 m³ (było 16); przy ujemnym saldzie list z podpowiedzią o wywozie; po przekroczeniu −8 000 zł nowe zakupy i zlecenia są wstrzymane (bez zwalniania pracowników).
- **Policja na miejscu zdarzenia:** po złapaniu sprawcy patrol pyta: „Puść z pouczeniem” (tylko wykroczenia: quad, crossowiec; +2% ochrony, bez wpływu) albo „Wezwij Policję” (wszyscy czekają na radiowóz; mandat 250 zł, +7…10% ochrony; kłusownik, złodziej drewna i choinek — tylko Policja). Po 30 s bez wyboru: pouczenie albo Policja tam, gdzie pouczenie nie wchodzi w grę. Zniknęły przyciski „Wezwij Policję” z listy zgłoszeń i kart.
- **Pożar:** wieża przeciwpożarowa wzywa straż pożarną od razu. Bez wieży jedzie leśniczy: małe zarzewie gasi sam, większe — wzywa straż z miejsca. Wypalony obszar zależy od wielkości pożaru w chwili ugaszenia. Nowy wóz strażacki.
- **Szlabany** rysowane na bieżąco: dwa słupki i czerwono-biała rura na zawiasie (otwarta leży wzdłuż drogi, zamknięta w poprzek, na kłódkę). Szlaban przy szosie na północ od skrzyżowania j2 stoi dalej od szosy.
- **Parking** jako żwirowa zatoka przy drodze leśnej tuż za szosą (kłody, znak P, kosz, stół z ławami); odwiedzający naprawdę w niej parkują (dwa miejsca).
- **Wilki wędrowne** zamiast stałej populacji: wataha (2–5 osobników) pojawia się średnio raz na kilka lat, zostaje 3–8 dni gry, potem odchodzi i wraca najwcześniej po roku. W tym czasie zgryzanie jest mniejsze (do −25%), sarny i jelenie płochliwsze (+40% dystansu ucieczki), koło łowieckie pozyskuje o 30% mniej, a wilki zjadają część saren i jeleni. Listy przy pojawieniu i odejściu; fotopułapka może nagrać wilka. Stare zapisy: brak watahy.
- **Zwierzyna na szosie:** o zmierzchu i jesienią sarna, jeleń albo dzik przebiega przez szosę przed samochodem (zwykle auto tylko hamuje). Rzadko dochodzi do potrącenia: zwierzę leży przy jezdni (zgłoszenie „padlina”, zabiera patrol albo po dobie koło łowieckie), ucieka ranne (myśliwy z psem tropi je w lesie) albo zabiera je kierowca (sam list). Znaki ostrzegawcze i odstraszacze — w 0.9.

## Zmiany w 0.8.2 „Porządek w lesie”
- **Dzikie wysypiska:** wieczorem lub nocą (średnio co kilka dni, rzadziej zimą) samochód z przyczepą zostawia w lesie stos odpadów. Zgłoszenie „Zleć wywóz · 700 zł” wysyła śmieciarkę firmy wywozowej (jedzie w godzinach 7–16, ładowacze zbierają odpady). Nieusunięte wysypisko liczy się w stanie lasu jak kilka worków śmieci i ciąży na ochronie terenu. Patrol sam wysypiska nie sprząta.
- **Policja:** na karcie quada, crossa i nocnego intruza (kłusownik, złodziej drewna, choinek) jest przycisk „Wezwij Policję”. Radiowóz przyjeżdża po kilkudziesięciu minutach gry, zatrzymuje sprawcę (+ochrona, wpływ 250 zł). Jeśli patrol zdąży pierwszy, Policja odjeżdża.
- **Fotopułapki** (L, 2 400 zł, 25 zł dziennie): kamery na słupkach szlabanów przy wjazdach. Nielegalne wjazdy i wysypiska są zgłaszane od razu, a z nagrania wpływa mandat (150 zł za zatrzymanie, 450 zł za wysypisko).
- **Szlabany** (L, bezpłatnie): zamknięte odstraszają o połowę nielegalnych wjazdów (quady, nocni intruzi, wysypiska), ale bez parkingu zmniejszają też liczbę grzybiarzy i spacerowiczów.
- **Parking leśny z koszem** (L, 3 500 zł, 15 zł dziennie): na zarezerwowanym miejscu przy szosie; odwiedzający zostawiają ok. 65% mniej śmieci, a przy zamkniętych szlabanach nadal mają gdzie zaparkować.
- Nowe pojazdy: radiowóz i śmieciarka. Quady i crossy działają jak wcześniej; zmienia je tylko to, że szlabany i fotopułapki wpływają na ich liczbę i szybkość zgłoszenia.
