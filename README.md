# Leśniczówka — symulator leśnictwa

Przeglądarkowa gra pixel-art o prowadzeniu małego polskiego leśnictwa. Widok z góry, wszystko rysowane kodem (bez plików graficznych).
**Wersja 0.8.4 — prototyp.** Silnik i sposób rysowania pochodzą z „Polskiej wsi” 0.6.2.

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
| Kółko / Z / + − | przybliżenie (całkowite skale, ostre piksele) |
| 1 / 2 / 3 / 4 | podgląd / wycinka / sadzenie / odnowienie |
| Przeciągnij lewym (w narzędziach 2–4) | zaznacz obszar: drzewa do wycinki, rzędy sadzonek, powierzchnię odnowieniową |
| Prawy przycisk | przesuwanie mapy (w podglądzie także lewy) |
| E | wyślij ekipę |
| L | Leśniczówka: kadry, budynki, sprzęt, koło łowieckie, paśniki (także klik w dom) |
| Tab | mapa leśnictwa (gatunki / wiek, klik przenosi kamerę) |
| U | schowaj / pokaż interfejs |
| N | przewijanie nocy wł./wył. |
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
| `src/paint.js` | podłoże: ściółka, pobocza, drogi, plac | wzorzec `world.js` |
| `src/mail.js` | poczta (dziennik zdarzeń), priorytety zgłoszeń, zwalnianie czasu | nowe w 0.8.1 |
| `src/order.js` | dzikie wysypiska, firma wywozowa, Policja (na miejscu), fotopułapki, szlabany (rura na zawiasie), zatoka parkingowa | nowe w 0.8.2, przerobione w 0.8.3 |
| `src/crossing.js` | zwierzyna na szosie, potrącenia, padlina, myśliwy z psem | nowe w 0.8.3 |
| `src/oddcard.js` | statystyki do karty oddziału | nowe w 0.8.1 |
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
| `src/mapview.js` | mapa leśnictwa (Tab) | nowe (0.6) |
| `src/render.js` | kolejność warstw, noc, znaczniki | wzorzec z farmy |
| `src/ui.js`, `src/input.js` | HUD, mysz i klawiatura | nowe |
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
