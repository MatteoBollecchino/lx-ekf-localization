# Lab Kit: Autonomous Mobile Robot Localization

Self-contained exercise folders for the 4 localization modules. Each folder includes:
- `presentation.ipynb`: exercise notebook with `TODO` sections to complete during the presentation.
- `solution.ipynb`: complete working solution notebook.
- `requirements.txt`: Python dependencies to run directly inside that folder.
- `assets/`: all local images and configuration files needed by the notebooks (no external repo paths required).

## Quick Start (per folder)

```bash
cd lx-localization-labkit/01-kalman-filter   # or 02-particle-filter, 03-histogram-filter, 04-ekf-localization
pip install -r requirements.txt
jupyter notebook
```

## Module Notes

1. **01-kalman-filter**: Pure Python (`numpy`, `matplotlib`).
2. **02-particle-filter**: Pure Python (`numpy`, `scipy`, `matplotlib`, `opencv-python`, `tqdm`).
3. **03-histogram-filter**: Includes local `assets/histogram_filter_config.yaml` and lane images; `requirements.txt` installs `lib-dt-computer-vision` and `lib-dt-state-estimation` directly from Duckietown GitHub (`@ente`).
4. **04-ekf-localization**: Designed to run with **ROS + Duckiematrix**. Includes `ekf_template.py` (exercise starter), `ekf_solution.py` (complete ROS-safe `EKF` class), and reference `assets/map.yaml` and `assets/default.yaml`. Copy your completed `ekf.py` into `packages/solution/ekf.py` and run `dts code build` / `dts code workbench --sim`.
