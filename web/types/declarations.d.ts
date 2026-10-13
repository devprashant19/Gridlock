declare module 'viem' {
  export type Address = `0x${string}`;
  export type Hex = `0x${string}`;
  export type Hash = `0x${string}`;
  export type Abi = readonly any[];
  export type ContractFunctionName<TAbi = any, TMut = any> = string;
  export type ContractFunctionArgs<TAbi = any, TMut = any, TF = any> = readonly any[];
  export type LocalAccount = {
    address: Address;
    signMessage: (args: any) => Promise<Hex>;
    signTransaction: (tx: any, opts?: any) => Promise<Hex>;
    signTypedData?: (args: any) => Promise<Hex>;
    [key: string]: any;
  };
  export type WalletClient = any;
  export type TransactionSerializable = any;

  export const createPublicClient: any;
  export const createWalletClient: any;
  export const defineChain: any;
  export const http: any;
  export const parseAbi: any;
  export const keccak256: any;
  export const toBytes: any;
  export const bytesToHex: any;
  export const hexToBytes: any;
  export const formatEther: any;
  export const parseEventLogs: any;
  export const decodeFunctionData: any;
  export const encodeFunctionData: any;
  export const parseTransaction: any;
  export const recoverTransactionAddress: any;
  export const isAddressEqual: (a: Address, b: Address) => boolean;
  export const toAccount: any;
  export const custom: any;
  export const isAddress: (val: string) => val is Address;
}

declare module 'viem/chains' {
  export const monadTestnet: any;
}
