use serde::Serialize;
use serialport::{SerialPortInfo, SerialPortType, UsbPortInfo};
use std::cmp::Ordering;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortDescriptor {
    pub name: String,
    pub label: String,
    pub connection_type: String,
}

pub fn list() -> Result<Vec<SerialPortDescriptor>, String> {
    let ports = serialport::available_ports()
        .map_err(|error| format!("Não foi possível listar as portas seriais: {error}"))?;
    let mut descriptors = ports.into_iter().map(describe).collect::<Vec<_>>();
    descriptors.sort_by(|left, right| compare_port_names(&left.name, &right.name));
    Ok(descriptors)
}

fn describe(port: SerialPortInfo) -> SerialPortDescriptor {
    let (connection_type, detail) = match port.port_type {
        SerialPortType::UsbPort(info) => ("usb", usb_detail(&info)),
        SerialPortType::BluetoothPort => ("bluetooth", Some("Bluetooth".to_string())),
        SerialPortType::PciPort => ("pci", Some("PCI".to_string())),
        SerialPortType::Unknown => ("unknown", None),
    };
    let label = detail
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("{} - {value}", port.port_name))
        .unwrap_or_else(|| port.port_name.clone());

    SerialPortDescriptor {
        name: port.port_name,
        label,
        connection_type: connection_type.to_string(),
    }
}

fn usb_detail(info: &UsbPortInfo) -> Option<String> {
    let named = [info.product.as_deref(), info.manufacturer.as_deref()]
        .into_iter()
        .flatten()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(" / ");
    if !named.is_empty() {
        Some(named)
    } else {
        Some(format!("USB {:04X}:{:04X}", info.vid, info.pid))
    }
}

fn compare_port_names(left: &str, right: &str) -> Ordering {
    match (com_port_number(left), com_port_number(right)) {
        (Some(left_number), Some(right_number)) => left_number.cmp(&right_number),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => left.to_ascii_lowercase().cmp(&right.to_ascii_lowercase()),
    }
}

fn com_port_number(name: &str) -> Option<u32> {
    name.trim()
        .to_ascii_uppercase()
        .strip_prefix("COM")?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_windows_com_ports_numerically() {
        let mut ports = ["COM10", "ttyUSB0", "COM2", "COM1"];
        ports.sort_by(|left, right| compare_port_names(left, right));
        assert_eq!(ports, ["COM1", "COM2", "COM10", "ttyUSB0"]);
    }

    #[test]
    fn detects_only_valid_windows_com_names() {
        assert_eq!(com_port_number("com12"), Some(12));
        assert_eq!(com_port_number("COM"), None);
        assert_eq!(com_port_number("ttyUSB0"), None);
    }
}
