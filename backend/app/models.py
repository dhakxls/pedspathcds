from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import json
import yaml

from .schemas import Encounter, Patient

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"


class DataStore:
    def __init__(self) -> None:
        self.patients = self._load_patients()
        self.patient_index: Dict[str, Patient] = {p.patient_id: p for p in self.patients}
        self.encounters = self._load_encounters()

    def _load_patients(self) -> List[Patient]:
        path = DATA_DIR / "synthetic_patients.json"
        with path.open() as f:
            patients_raw = json.load(f)
        return [Patient(**p) for p in patients_raw]

    def _load_encounters(self) -> List[Encounter]:
        path = DATA_DIR / "synthetic_encounters.json"
        with path.open() as f:
            data = json.load(f)
        return [Encounter(**item) for item in data]

    def get_patient(self, patient_id: str) -> Patient:
        if patient_id not in self.patient_index:
            raise KeyError(patient_id)
        return self.patient_index[patient_id]


class ConfigStore:
    def __init__(self) -> None:
        self.bronchiolitis = self._load_config("bronchiolitis.yaml")
        self.demo_hospital = self._load_config("demo_hospital.yaml")

    def _load_config(self, filename: str) -> dict:
        path = CONFIG_DIR / filename
        with path.open() as f:
            return yaml.safe_load(f)
