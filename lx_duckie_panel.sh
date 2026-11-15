#!/usr/bin/env bash

# Virtual and Physical Duckiebots names
BOT="myduckiebot"
VBOT="vbot"

run_in_term() {
    local title="$1"
    local cmd="$2"
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --title="$title" -- bash -c "$cmd; echo -e '\nPremi Invio per chiudere...'; read"
    elif command -v ptyxis &> /dev/null; then
        ptyxis --tab --title="$title" -- bash -c "$cmd; echo -e '\nPremi Invio per chiudere...'; read"
    elif command -v konsole &> /dev/null; then
        konsole --new-tab -p tabtitle="$title" -e bash -c "$cmd; read"
    else
        xterm -T "$title" -e bash -c "$cmd; read" &
    fi
}

while true; do
    TERM_LINES=$(tput lines)
    TERM_COLS=$(tput cols)

    HEIGHT=$(( TERM_LINES > 24 ? 21 : TERM_LINES - 2 ))
    WIDTH=$(( TERM_COLS > 124 ? 120 : TERM_COLS - 4 ))
    MENU_HEIGHT=$(( HEIGHT - 7 ))

    CHOICE=$(whiptail --title "🦆 Virtual Bot & Learning Experience Control Panel" \
        --menu "Seleziona il comando da inviare:" $HEIGHT $WIDTH $MENU_HEIGHT \
        "1"  "[CREA VIRTUAL BOT]            - dts duckiebot virtual create --type duckiebot --configuration DB21J $VBOT" \
        "2"  "[VIRTUAL BOT START]           - dts duckiebot virtual start $VBOT" \
        "3"  "[VIRTUAL BOT STOP]            - dts duckiebot virtual stop $VBOT" \
        "4"  "[DUCKIEMATRIX RUN]            - dts matrix run --standalone --embedded --map sandbox" \
        "5"  "[MATRIX ATTACH VBOT]          - dts matrix attach $VBOT map_0/vehicle_0" \
        "6"  "[LX: START MATRIX]            - dts code start_matrix" \
        "7"  "[LX: BUILD CODE VIRTUAL BOT]  - dts code build -R $VBOT" \
        "8"  "[LX: BUILD CODE PHYSICAL BOT] - dts code build -R $BOT" \
        "9"  "[LX: WORKBENCH (MATRIX)]      - dts code workbench -m -R $VBOT" \
        "10" "[LX: WORKBENCH (BOT)]         - dts code workbench -R $BOT" \
        "11" "[LX: noVNC VIRTUAL ROBOT]     - dts code vnc -R $VBOT" \
        "12" "[LX: noVNC PHYSICAL ROBOT]    - dts code vnc -R $BOT" \
        "0"  "Esci dal pannello" 3>&1 1>&2 2>&3)

    exitstatus=$?
    if [ $exitstatus != 0 ] || [ "$CHOICE" == "0" ]; then
        clear
        exit 0
    fi

    case $CHOICE in
        1)
            run_in_term "Crea Virtual Bot" "dts duckiebot virtual create --type duckiebot --configuration DB21J $VBOT"
            ;;
        2)
            run_in_term "Start Virtual Bot" "dts duckiebot virtual start $VBOT"
            ;;
        3)
            run_in_term "Stop Virtual Bot" "dts duckiebot virtual stop $VBOT"
            ;;
        4)
            run_in_term "Duckiematrix Standalone" "dts matrix run --standalone --embedded --map sandbox"
            ;;
        5)
            run_in_term "Attach Matrix" "dts matrix attach $VBOT map_0/vehicle_0"
            ;;
        6)
            run_in_term "LX: Start Matrix" "dts code start_matrix"
            ;;
        7)
            run_in_term "LX: Build ($VBOT)" "dts code build -R $VBOT"
            ;;
        8)
            run_in_term "LX: Build ($BOT)" "dts code build -R $BOT"
            ;;
        9)
            run_in_term "LX: Workbench Matrix ($VBOT)" "dts code workbench -m -R $VBOT"
            ;;
        10)
            run_in_term "LX: Workbench ($BOT)" "dts code workbench -R $BOT"
            ;;
        11)
            run_in_term "LX: noVNC ($VBOT)" "dts code vnc -R $VBOT"
            ;;
        12)
            run_in_term "LX: noVNC ($BOT)" "dts code vnc -R $BOT"
            ;;
    esac
done
