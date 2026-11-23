#!/usr/bin/env python3

import numpy as np
from multiprocessing import Lock


def wrap_angle(a):
    """Wrap angle to [-pi, pi]."""
    return (a + np.pi) % (2*np.pi) - np.pi


"""
class EKF:
    def __init__(self, q_0: np.ndarray, P_0: np.ndarray, Q: np.ndarray, R: np.ndarray):
        self.q = q_0
        self.P = P_0
        self.Q = Q
        self.R = R
        self.q_mutex = Lock()

    def predict(self, dX, dT):

        with self.q_mutex:

            # Step 1: update the pose estimate using the kinematic model
            # TODO: Update these equations
            self.q[0] = self.q[0]
            self.q[1] = self.q[1]
            self.q[2] = self.q[2]

            self.q[2] = wrap_angle(self.q[2])

            # Step 2: Calculate the process model Jacobians
            # TODO: Define F and W
            F = np.array([])
            W = np.array([])

            # Step 3: update the covariance estimate
            # TODO: Update this equation
            self.P = self.P

    def update(self, z: np.ndarray, tag_xy: np.ndarray):
        # z is the measurement in the form [range, bearing]
        # tag_xy is the tag location of the tag in world coordinates [tag_x, tag_y]

        with self.q_mutex:

            # Step 1: calculate the predicted range and bearing measurements
            # TODO: update the equations below
            rng_pred = 1.0
            bearing_pred = 0.0
            z_pred = np.array([rng_pred, bearing_pred])

            # Step 2: Calculate the innovation
            # TODO: Define y
            y = np.array([0.0, 0.0])
            y[1] = wrap_angle(y[1])

            # Step 3: Calculate the measurement Jacobian
            # TODO: Define H
            H = np.array([])

            # Step 4: Calculate the Kalman gain
            # TODO: Define K
            K = np.array([])

            # Step 5: Update the state and covariance estimates
            # TODO: Update these equations
            self.q = self.q
            self.q[2] = wrap_angle(self.q[2])
            self.P = self.P
"""

class EKF:
    def __init__(self, q_0: np.ndarray, P_0: np.ndarray, Q: np.ndarray, R: np.ndarray):
        """
        Inizializza il Filtro di Kalman Esteso.
        q_0: Vettore di posa iniziale [x, y, theta]
        P_0: Matrice di covarianza iniziale (3x3)
        Q: Covarianza rumore di processo comandi (2x2: diag(Q_xx, Q_tt))
        R: Covarianza rumore sensore AprilTag (2x2: diag(R_rr, R_tt))
        """
        self.q = np.array(q_0, dtype=float)
        self.P = np.array(P_0, dtype=float)
        self.Q = np.array(Q, dtype=float)
        self.R = np.array(R, dtype=float)

    def predict(self, dX: float, dT: float):
        """
        Fase di Predizione: aggiorna posa e covarianza usando l'odometria delle ruote.
        """
        theta = self.q[2]
        
        # Step 1: Propagazione della posa col modello cinematico f
        self.q[0] += dX * np.cos(theta)
        self.q[1] += dX * np.sin(theta)
        self.q[2] = wrap_angle(self.q[2] + dT)
        
        # Step 2: Calcolo delle matrici Jacobiane F (3x3) e W (3x2)
        F = np.array([
            [1.0, 0.0, -dX * np.sin(theta)],
            [0.0, 1.0,  dX * np.cos(theta)],
            [0.0, 0.0,  1.0]
        ])
        
        W = np.array([
            [np.cos(theta), 0.0],
            [np.sin(theta), 0.0],
            [0.0,           1.0]
        ])
        
        # Step 3: Aggiornamento della covarianza predetta
        self.P = F @ self.P @ F.T + W @ self.Q @ W.T

    def update(self, z: np.ndarray, tag_xy: np.ndarray):
        """
        Fase di Aggiornamento: corregge la posa usando la misura di un AprilTag notando (tag_x, tag_y).
        z: [range, bearing]
        tag_xy: [tag_x, tag_y]
        """
        # Step 1: Calcolo della misura predetta [range_pred, bearing_pred]
        dx = tag_xy[0] - self.q[0]
        dy = tag_xy[1] - self.q[1]
        
        rng_pred = np.sqrt(dx**2 + dy**2)
        if rng_pred == 0:
            return
            
        bearing_pred = wrap_angle(np.arctan2(dy, dx) - self.q[2])
        z_pred = np.array([rng_pred, bearing_pred])
        
        # Step 2: Calcolo dell'innovazione (residuo)
        y = z - z_pred
        y[1] = wrap_angle(y[1])
        
        # Step 3: Calcolo della Jacobiana di Misura H (2x3)
        H = np.array([
            [-dx / rng_pred,       -dy / rng_pred,        0.0],
            [ dy / (rng_pred**2),  -dx / (rng_pred**2),  -1.0]
        ])
        
        # Step 4: Calcolo del Guadagno di Kalman K (3x2)
        S = H @ self.P @ H.T + self.R
        K = self.P @ H.T @ np.linalg.inv(S)
        
        # Step 5: Aggiornamento finale di posa e covarianza
        self.q = self.q + K @ y
        self.q[2] = wrap_angle(self.q[2])
        
        I = np.eye(3)
        self.P = (I - K @ H) @ self.P






