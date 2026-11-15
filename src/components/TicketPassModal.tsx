import React from 'react';
import { TicketDetailModal, TicketDetailModalProps } from './TicketDetailModal';

export type TicketPassModalProps = TicketDetailModalProps;

export const TicketPassModal: React.FC<TicketPassModalProps> = (props) => {
  return <TicketDetailModal {...props} />;
};
