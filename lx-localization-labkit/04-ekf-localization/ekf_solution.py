#!/usr/bin/env python3

import numpy as np
from multiprocessing import Lock


def wrap_angle(a):
    """Wrap angle to [-pi, pi]."""
    return (a + np.pi) % (2 * np.pi) - np.pi


class EKF:
    def __init__(self, q_0: np.ndarray, P_0: np.ndarray, Q: np.ndarray, R: np.ndarray):
        self.q = np.array(q_0, dtype=float)
        self.P = np.array(P_0, dtype=float)
        self.Q = np.array(Q, dtype=float)
        self.R = np.array(R, dtype=float)
        self.q_mutex = Lock()

    def predict(self, dX: float, dT: float):
        with self.q_mutex:
            theta = self.q[2]

            # Step 1: propagate the state using the kinematic model
            self.q[0] += dX * np.cos(theta)
            self.q[1] += dX * np.sin(theta)
            self.q[2] = wrap_angle(self.q[2] + dT)

            # Step 2: calculate the process model Jacobians F (3x3) and W (3x2)
            F = np.array([
                [1.0, 0.0, -dX * np.sin(theta)],
                [0.0, 1.0,  dX * np.cos(theta)],
                [0.0, 0.0,  1.0],
            ])

            W = np.array([
                [np.cos(theta), 0.0],
                [np.sin(theta), 0.0],
                [0.0,           1.0],
            ])

            # Step 3: update the state covariance estimate
            self.P = F @ self.P @ F.T + W @ self.Q @ W.T

    def update(self, z: np.ndarray, tag_xy: np.ndarray):
        # z is [range, bearing], tag_xy is [tag_x, tag_y]
        with self.q_mutex:
            # Step 1: calculate the predicted range and bearing measurements
            dx = tag_xy[0] - self.q[0]
            dy = tag_xy[1] - self.q[1]

            rng_pred = np.sqrt(dx**2 + dy**2)
            if rng_pred == 0:
                return

            bearing_pred = wrap_angle(np.arctan2(dy, dx) - self.q[2])
            z_pred = np.array([rng_pred, bearing_pred])

            # Step 2: calculate the innovation
            y = z - z_pred
            y[1] = wrap_angle(y[1])

            # Step 3: calculate the measurement Jacobian H (2x3)
            H = np.array([
                [-dx / rng_pred,       -dy / rng_pred,        0.0],
                [ dy / (rng_pred**2),  -dx / (rng_pred**2),  -1.0],
            ])

            # Step 4: calculate the Kalman gain K (3x2)
            S = H @ self.P @ H.T + self.R
            K = self.P @ H.T @ np.linalg.inv(S)

            # Step 5: update the state and covariance estimates
            self.q = self.q + K @ y
            self.q[2] = wrap_angle(self.q[2])

            I = np.eye(3)
            self.P = (I - K @ H) @ self.P
